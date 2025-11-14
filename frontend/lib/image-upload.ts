import { API_BASE } from "@/lib/api";

export async function uploadImageToS3(file: File, accessToken: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file);

  const uploadUrl = `${API_BASE}/uploads/images/`;
  const response = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken || ""}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    console.error("Upload error response:", errorData);
    throw new Error("Upload failed");
  }

  const data = await response.json();
  return data.url;
}
