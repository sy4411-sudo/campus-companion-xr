// ============================================================
//  GET /api/video-proxy?id=<DRIVE_FILE_ID>
//
//  Streams a Google Drive video file through our origin so that
//  <video crossorigin="anonymous"> can sample it for THREE.VideoTexture
//  uploads (Drive itself does NOT send the CORS headers required for
//  cross-origin GPU uploads). The proxy:
//    • only allows a hard-coded list of Drive file IDs
//    • follows Drive's "virus scan" warning redirect via the modern
//      drive.usercontent.google.com endpoint with confirm=t
//    • forwards the client's Range header to upstream so video
//      seeking works
//    • forwards Content-Length / Content-Range / Accept-Ranges back
//    • adds Access-Control-Allow-Origin:* + CORP so this project's
//      strict COEP environment can still read the bytes
// ============================================================

export const config = { runtime: "edge" }

// Whitelist of accepted Drive file IDs. Add new clip IDs here when
// you upload more videos to the same Drive account.
const ALLOWED_IDS = new Set([
  "1nnOb541EaREf6KtEWDXO5_D7cAu76Quj", // Castle in the Sky
  "107Y1T8QiExo85yT0B4RarPRBqd-dTy87", // Good Will Hunting
  "1GPIVLY5EHqzOs4ZftdXvnWhvOkbbUdFc", // Green Book
])

const PASSTHROUGH_RES_HEADERS = [
  "content-length",
  "content-range",
  "content-type",
  "last-modified",
  "etag",
]

function corsHeaders(extra = {}) {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
    "Access-Control-Allow-Headers": "Range, Content-Type",
    "Access-Control-Expose-Headers":
      "Content-Length, Content-Range, Content-Type, Accept-Ranges",
    "Cross-Origin-Resource-Policy": "cross-origin",
    "Accept-Ranges": "bytes",
    ...extra,
  }
}

export default async function handler(req) {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders() })
  }
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    })
  }

  const { searchParams } = new URL(req.url)
  const id = searchParams.get("id")
  if (!id || !ALLOWED_IDS.has(id)) {
    return new Response(JSON.stringify({ error: "Unknown or missing id" }), {
      status: 400,
      headers: { "Content-Type": "application/json", ...corsHeaders() },
    })
  }

  // Modern Drive direct-download endpoint that bypasses the legacy
  // HTML virus-scan interstitial when ?confirm=t is supplied.
  const target =
    `https://drive.usercontent.google.com/download?id=${encodeURIComponent(id)}` +
    `&export=download&confirm=t&authuser=0`

  const upstreamHeaders = {}
  const range = req.headers.get("range")
  if (range) upstreamHeaders["Range"] = range

  let upstream
  try {
    upstream = await fetch(target, {
      method: req.method,
      headers: upstreamHeaders,
      redirect: "follow",
    })
  } catch (err) {
    return new Response(
      JSON.stringify({ error: "Upstream fetch failed", message: String(err?.message || err) }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    )
  }

  // Drive sometimes returns an HTML quota / login page instead of the
  // file. Detect that early and surface a clear error so the client
  // can fall back to the popup-preview path.
  const contentType = upstream.headers.get("content-type") || ""
  if (contentType.startsWith("text/html")) {
    return new Response(
      JSON.stringify({
        error: "Upstream returned HTML (quota / login required)",
        message:
          "Drive served the virus-scan or sign-in page rather than the file. " +
          "Make sure the file is shared as 'Anyone with the link → Viewer'.",
      }),
      { status: 502, headers: { "Content-Type": "application/json", ...corsHeaders() } },
    )
  }

  const respHeaders = new Headers()
  for (const h of PASSTHROUGH_RES_HEADERS) {
    const v = upstream.headers.get(h)
    if (v) respHeaders.set(h, v)
  }
  // Default to mp4 if upstream omits a content-type.
  if (!respHeaders.get("content-type")) {
    respHeaders.set("content-type", "video/mp4")
  }
  // Edge cache for 5 min so seeks within the same clip are snappy.
  respHeaders.set("Cache-Control", "public, max-age=300, s-maxage=300")
  for (const [k, v] of Object.entries(corsHeaders())) respHeaders.set(k, v)

  // Stream the body straight through (Edge runtime supports passing a
  // ReadableStream as the Response body, no buffering needed).
  return new Response(upstream.body, {
    status: upstream.status,
    headers: respHeaders,
  })
}
