import { AccessToken, RoomConfiguration } from "livekit-server-sdk";
import { createClient } from "@supabase/supabase-js";

// Issues a short-lived pass that lets one person join one LiveKit room.
//
// Scheduled meetings (room = meeting id) have a waiting room:
//   * the host (verified from their Supabase login) gets in straight away;
//   * everyone else needs a join request the host has admitted.
// Ad-hoc rooms that aren't in the database stay open to anyone with the link.

const ROOM_RE = /^[\w-]{3,64}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function supabaseFor(accessToken?: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: accessToken ? { headers: { Authorization: `Bearer ${accessToken}` } } : undefined,
  });
}

const fail = (error: string, status: number, extra?: Record<string, unknown>) =>
  Response.json({ error, ...extra }, { status });

export async function POST(request: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return fail(
      "Video isn't set up yet. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to .env and restart the dev server.",
      500,
    );
  }
  // Catch the example values from the setup instructions
  if (/your[_-]/i.test(LIVEKIT_URL + LIVEKIT_API_KEY + LIVEKIT_API_SECRET)) {
    return fail(
      "Your .env still has the example LiveKit values. Replace them with the real URL, API key and secret from your LiveKit Cloud project, then restart the dev server.",
      500,
    );
  }

  let body: { room?: unknown; name?: unknown; requestId?: unknown; requestSecret?: unknown };
  try {
    body = await request.json();
  } catch {
    return fail("Invalid request.", 400);
  }

  const room = typeof body.room === "string" ? body.room : "";
  let name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!ROOM_RE.test(room)) return fail("Invalid meeting link.", 400);

  // ---- Scheduled meeting? Then the waiting room applies. ----
  if (UUID_RE.test(room)) {
    const anon = supabaseFor();
    if (anon) {
      const { data: info } = await anon.rpc("get_meeting_public", { p_id: room });
      const meeting = (info as { status: string }[] | null)?.[0];
      if (meeting) {
        if (meeting.status !== "scheduled") return fail("This meeting was cancelled.", 410);

        // 1) The host, or an invited signed-in user
        //    (who the caller is comes from their Supabase session, if any)
        const bearer = request.headers.get("authorization")?.match(/^Bearer (.+)$/)?.[1];
        const caller = bearer ? supabaseFor(bearer)! : anon;
        const { data: direct, error: directError } = await caller.rpc("can_join_directly", { p_meeting: room });
        let allowed = direct === true;
        // Before migration 0004 is run, fall back to "only the host skips the waiting room"
        if (directError && bearer) {
          const { data: isHost } = await caller.rpc("is_meeting_host", { p_meeting: room });
          allowed = isHost === true;
        }

        // 2) Someone the host admitted from the waiting room
        if (!allowed && typeof body.requestId === "string" && typeof body.requestSecret === "string") {
          const { data: claim } = await anon.rpc("claim_join_request", {
            p_id: body.requestId,
            p_secret: body.requestSecret,
          });
          const admitted = (claim as { meeting_id: string; name: string }[] | null)?.[0];
          if (admitted?.meeting_id === room) {
            allowed = true;
            name = admitted.name; // the name the host approved
          }
        }

        if (!allowed) {
          // Invite-only meetings have no waiting room
          if ((info as { access?: string }[])[0]?.access === "invite_only") {
            return fail(
              bearer
                ? "This meeting is invite only, and your account's email isn't on the invite list."
                : "This meeting is invite only. Log in with the email you were invited with.",
              403,
              { code: "invite_only", signedIn: Boolean(bearer) },
            );
          }
          return fail("The host needs to let you in.", 403, { code: "approval_required" });
        }
      }
    }
  }

  if (!name) return fail("Please enter your name.", 400);

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    // identity must be unique per connection; the name is what people see
    identity: `${name.toLowerCase().replace(/[^\w]+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`,
    name,
    ttl: "2h",
  });
  // Applied when this join creates the room: close it if nobody shows up
  // within 5 minutes, and 1 minute after the last person leaves
  token.roomConfig = new RoomConfiguration({ emptyTimeout: 300, departureTimeout: 60 });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // lets people set their own "hand raised" / avatar attributes
    canUpdateOwnMetadata: true,
  });

  return Response.json({ token: await token.toJwt(), url: LIVEKIT_URL });
}
