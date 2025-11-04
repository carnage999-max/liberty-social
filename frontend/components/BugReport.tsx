"use client";

import { useState } from "react";

export default function ReportBug() {
    const [open, setOpen] = useState(false);
    const [message, setMessage] = useState("");
    const [screenshot, setScreenshot] = useState<File | null>(null);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        setSending(true);
        const formData = new FormData();
        formData.append("message", message);
        if (screenshot) formData.append("screenshot", screenshot);

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/feedback/`, {
            method: "POST",
            body: formData,
        });
        setSending(false);
        if (res.ok) {
            setSent(true);
            setMessage("");
            setScreenshot(null);
        }
    }

    return (
        <>
            {/* Floating button */}
            <button
                onClick={() => setOpen(true)}
                className="fixed bottom-6 right-6 bg-blue-600 text-white rounded-full w-14 h-14 shadow-lg hover:bg-blue-700 transition flex items-center justify-center text-2xl z-50"
                aria-label="Report Bug"
            >
                🐞
            </button>

            {/* Modal */}
            {open && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md relative">
                        <button
                            className="absolute top-3 right-3 text-gray-500 hover:text-black"
                            onClick={() => setOpen(false)}
                        >
                            ✕
                        </button>

                        <h2 className="text-xl font-semibold mb-3">Report a Bug</h2>

                        {sent ? (
                            <p className="text-green-600">✅ Thank you! Your report has been sent.</p>
                        ) : (
                            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                                <textarea
                                    className="border p-2 rounded-md w-full min-h-[100px]"
                                    placeholder="Describe the issue..."
                                    value={message}
                                    onChange={(e) => setMessage(e.target.value)}
                                    required
                                />
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => setScreenshot(e.target.files?.[0] || null)}
                                />
                                <button
                                    type="submit"
                                    className="bg-blue-600 text-white py-2 rounded-md hover:bg-blue-700"
                                    disabled={sending}
                                >
                                    {sending ? "Sending..." : "Send Report"}
                                </button>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
