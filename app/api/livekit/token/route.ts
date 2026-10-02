import { AccessToken } from "livekit-server-sdk";

// Issues a short-lived token that lets one person join one LiveKit room.
// There's no login yet, so anyone with a meeting link can join under any name.
// Add auth / rate limiting here before going public, or people could burn
// through the free LiveKit minutes.

const ROOM_RE = /^[\w-]{3,64}$/;

export async function POST(request: Request) {
  const { LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET } = process.env;
  if (!LIVEKIT_URL || !LIVEKIT_API_KEY || !LIVEKIT_API_SECRET) {
    return Response.json(
      {
        error:
          "Video isn't set up yet. Add LIVEKIT_URL, LIVEKIT_API_KEY and LIVEKIT_API_SECRET to .env.local and restart the dev server.",
      },
      { status: 500 },
    );
  }

  // Catch the example values from the setup instructions
  if (/your[_-]/i.test(LIVEKIT_URL + LIVEKIT_API_KEY + LIVEKIT_API_SECRET)) {
    return Response.json(
      {
        error:
          "Your .env still has the example LiveKit values. Replace them with the real URL, API key and secret from your LiveKit Cloud project, then restart the dev server.",
      },
      { status: 500 },
    );
  }

  let body: { room?: unknown; name?: unknown };
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request." }, { status: 400 });
  }

  const room = typeof body.room === "string" ? body.room : "";
  const name = typeof body.name === "string" ? body.name.trim().slice(0, 40) : "";
  if (!ROOM_RE.test(room)) return Response.json({ error: "Invalid meeting link." }, { status: 400 });
  if (!name) return Response.json({ error: "Please enter your name." }, { status: 400 });

  const token = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    // identity must be unique per connection; the name is what people see
    identity: `${name.toLowerCase().replace(/[^\w]+/g, "-")}-${crypto.randomUUID().slice(0, 8)}`,
    name,
    ttl: "2h",
  });
  token.addGrant({
    room,
    roomJoin: true,
    canPublish: true,
    canSubscribe: true,
    canPublishData: true,
    // lets people set their own "hand raised" attribute
    canUpdateOwnMetadata: true,
  });

  return Response.json({ token: await token.toJwt(), url: LIVEKIT_URL });
}
