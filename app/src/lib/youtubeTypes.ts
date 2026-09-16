// YouTube channel read helper — Data API v3 channels endpoint.
export interface YtChannel {
  id: string
  title: string
  thumb: string | null
  subscribers: string
}

export async function loadChannelInfo(token: string): Promise<YtChannel | null> {
  const res = await fetch("/cors-proxy/", {
    headers: {
      Authorization: `Bearer ${token}`,
      "x-target-url":
        "https://www.googleapis.com/youtube/v3/channels?part=snippet,statistics&mine=true",
    },
  })
  if (!res.ok) return null
  const data = (await res.json().catch(() => null)) as {
    items?: { id: string; snippet: { title: string; thumbnails?: { default?: { url?: string } } }; statistics?: { subscriberCount?: string } }[]
  } | null
  const item = data?.items?.[0]
  if (!item) return null
  return {
    id: item.id,
    title: item.snippet.title,
    thumb: item.snippet.thumbnails?.default?.url ?? null,
    subscribers: item.statistics?.subscriberCount ?? "—",
  }
}