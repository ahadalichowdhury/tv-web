import { NextRequest, NextResponse } from "next/server";
import { isAdminAuthenticated } from "@/lib/auth";
import { toPublicChannels } from "@/lib/channel-public";
import { getChannels } from "@/lib/storage";

export async function GET(request: NextRequest) {
  const playlistId = request.nextUrl.searchParams.get("playlistId") || undefined;
  const group = request.nextUrl.searchParams.get("group") || undefined;
  const search = request.nextUrl.searchParams.get("search")?.toLowerCase();

  let channels = await getChannels(playlistId || undefined);
  const allGroups = [...new Set(channels.map((c) => c.group))].sort();

  if (group) {
    channels = channels.filter((c) => c.group === group);
  }

  if (search) {
    channels = channels.filter(
      (c) =>
        c.name.toLowerCase().includes(search) ||
        c.group.toLowerCase().includes(search) ||
        c.tvgName?.toLowerCase().includes(search)
    );
  }

  const authed = await isAdminAuthenticated();
  const visible = authed ? channels : toPublicChannels(channels);

  return NextResponse.json({
    channels: visible,
    groups: allGroups,
    total: channels.length,
  });
}
