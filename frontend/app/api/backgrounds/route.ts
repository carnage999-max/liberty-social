import { NextResponse } from "next/server";
import { readdir } from "fs/promises";
import { join } from "path";

export async function GET() {
  try {
    const backgroundsDir = join(process.cwd(), "public", "backgrounds");
    const files = await readdir(backgroundsDir);
    
    // Filter for image and video files
    const imageExtensions = [".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg"];
    const videoExtensions = [".mp4", ".webm", ".ogg", ".mov"];
    const allExtensions = [...imageExtensions, ...videoExtensions];
    
    const mediaFiles = files
      .filter((file) => {
        const ext = file.toLowerCase().substring(file.lastIndexOf("."));
        return allExtensions.includes(ext);
      })
      .map((file) => {
        const ext = file.toLowerCase().substring(file.lastIndexOf("."));
        return {
          url: `/backgrounds/${file}`,
          type: videoExtensions.includes(ext) ? "video" : "image",
        };
      })
      .sort((a, b) => a.url.localeCompare(b.url));
    
    return NextResponse.json({ backgrounds: mediaFiles });
  } catch (error) {
    console.error("Error reading backgrounds directory:", error);
    return NextResponse.json({ images: [] }, { status: 200 });
  }
}

