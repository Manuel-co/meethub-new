// Camera/microphone helpers and friendly error messages.

export type DeviceKind = "camera" | "microphone";

export function describeMediaError(err: unknown, kind: DeviceKind): string {
  const name = err instanceof Error ? err.name : "";
  const msg = err instanceof Error ? err.message : String(err);

  // Windows/macOS privacy settings block the browser itself
  if (/by system/i.test(msg))
    return `Your computer is blocking the browser from using the ${kind}. On Windows: Settings → Privacy & security → ${kind === "camera" ? "Camera" : "Microphone"} → turn on access for desktop apps.`;
  if (name === "NotAllowedError" || /permission denied|not allowed/i.test(msg))
    return `Your ${kind} is blocked for this site. Click the camera icon in the address bar, choose Allow, then try again.`;
  if (name === "NotReadableError" || /could not start|in use/i.test(msg))
    return `Your ${kind} is being used by another app (Zoom, Teams, the Camera app…). Close it and try again.`;
  if (name === "OverconstrainedError")
    return `The selected ${kind} isn't available. Pick another one.`;
  if (name === "NotFoundError" || /not found/i.test(msg))
    return `Your browser can't find a ${kind}. Check it's connected, then try again.`;
  return `Couldn't start your ${kind}. Try again.`;
}

/**
 * List cameras and mics.
 * Before the user grants permission, browsers still list each device but with
 * an empty id and label — so count every entry, and only use ids for pickers.
 */
export async function listDevices() {
  try {
    const all = await navigator.mediaDevices.enumerateDevices();
    return {
      cameras: all.filter((d) => d.kind === "videoinput"),
      mics: all.filter((d) => d.kind === "audioinput"),
    };
  } catch {
    return { cameras: [], mics: [] };
  }
}

export type PermissionStatus = "granted" | "denied" | "prompt" | "unknown";

/**
 * Has this site been allowed to use the camera/microphone? Asking does NOT
 * trigger the browser prompt. Some browsers (e.g. older Firefox, Safari)
 * don't support the query — that's "unknown".
 */
export async function queryPermission(kind: DeviceKind): Promise<PermissionStatus> {
  try {
    const res = await navigator.permissions.query({ name: kind as PermissionName });
    return res.state as PermissionStatus;
  } catch {
    return "unknown";
  }
}

/** Is this a "permission denied" error (rather than no device / device busy)? */
export const isPermissionError = (err: unknown) =>
  err instanceof Error && (err.name === "NotAllowedError" || /permission denied|not allowed/i.test(err.message));

/** Devices we can actually pick by id (after permission), minus Chrome's "default"/"communications" aliases */
export const selectable = (list: MediaDeviceInfo[]) =>
  list.filter((d) => d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications");
