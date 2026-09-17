import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { request } from "node:https";
export function publicAddress(address: string) {
  if (isIP(address) === 6) return /^[23][0-9a-f]{3}:/i.test(address); // Global unicast only; mapped/ULA/link-local denied.
  if (isIP(address) !== 4) return false;
  const [a, b, c] = address.split(".").map(Number);
  return !(
    a === 0 ||
    a === 10 ||
    a === 127 ||
    a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && (b === 168 || b === 0 || (b === 88 && c === 99))) ||
    (a === 198 && (b === 18 || b === 19 || b === 51)) ||
    (a === 203 && b === 0 && c === 113)
  );
}
export function publicUrl(value: string) {
  try {
    const url = new URL(value),
      host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    )
      return "";
    if (!host.includes(".") && !isIP(host)) return "";
    if (
      /^(localhost|metadata\.google\.internal)$/.test(host) ||
      /\.(localhost|local|internal|lan|home|test|invalid)$/.test(host)
    )
      return "";
    if (isIP(host) && !publicAddress(host)) return "";
    return url.href;
  } catch {
    return "";
  }
}
// Pin the actual request to a vetted DNS result, including after every redirect.
export async function publicPage(value: string): Promise<string> {
  let current = value;
  for (let i = 0; i < 5; i++) {
    if (!publicUrl(current)) throw new Error("URL publique HTTPS attendue");
    const url = new URL(current),
      hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = await lookup(hostname, { all: true });
    if (!addresses.length || addresses.some((a) => !publicAddress(a.address)))
      throw new Error("Destination privée refusée");
    const { address, family } = addresses[0];
    const result = await new Promise<{
      status: number;
      location?: string;
      text: string;
    }>((resolve, reject) => {
      const req = request(
        url,
        {
          method: "GET",
          headers: {
            "User-Agent": "Ubique/1.0",
            Accept: "text/html,text/plain",
          },
          lookup: (_host, options, callback) => {
            if (typeof options === "object" && options.all)
              callback(null, [{ address, family }]);
            else callback(null, address, family);
          },
          signal: AbortSignal.timeout(15000),
        },
        (res) => {
          const status = res.statusCode || 0;
          if (status >= 300 && status < 400) {
            res.resume();
            resolve({ status, location: res.headers.location, text: "" });
            return;
          }
          if (
            status !== 200 ||
            !/text\/(html|plain)/i.test(String(res.headers["content-type"]))
          ) {
            res.resume();
            reject(new Error("Page illisible : collez le texte de l’offre."));
            return;
          }
          let size = 0;
          const chunks: Buffer[] = [];
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > 2000000) {
              req.destroy(new Error("Page trop volumineuse"));
            } else chunks.push(chunk);
          });
          res.on("end", () =>
            resolve({ status, text: Buffer.concat(chunks).toString("utf8") }),
          );
          res.on("error", reject);
        },
      );
      req.on("error", reject);
      req.end();
    });
    if (result.location) {
      current = new URL(result.location, current).href;
      continue;
    }
    return result.text
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .slice(0, 18000);
  }
  throw new Error("Trop de redirections : collez le texte de l’offre.");
}
