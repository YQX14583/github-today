import { fetch, ProxyAgent, type RequestInit } from "undici";

let proxyAgent: ProxyAgent | undefined;
let activeProxyUrl: string | undefined;

function getProxyAgent() {
  const proxyUrl = process.env.HTTPS_PROXY?.trim() || process.env.HTTP_PROXY?.trim();
  if (!proxyUrl) return undefined;

  if (!proxyAgent || activeProxyUrl !== proxyUrl) {
    proxyAgent = new ProxyAgent(proxyUrl);
    activeProxyUrl = proxyUrl;
  }

  return proxyAgent;
}

export function outboundFetch(url: string, init: RequestInit = {}) {
  return fetch(url, {
    ...init,
    dispatcher: getProxyAgent()
  });
}
