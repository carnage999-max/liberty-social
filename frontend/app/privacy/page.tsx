"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function PrivacyPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white safe-pt safe-px safe-pb">
      <div className="max-w-4xl mx-auto py-12 px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Privacy Policy
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Privacy Policy Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 space-y-8">
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 leading-relaxed">
              Liberty Social ("we," "our," "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use the Liberty Social platform.
            </p>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                1. Information We Collect
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Account Information:</strong> Name, email, phone number, profile details, and verification data.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>User Content:</strong> Posts, messages, media uploads, comments, and interactions.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Device Data:</strong> IP address, device type, OS, browser type, app version, and device identifiers.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Usage Data:</strong> Activity logs, login timestamps, session length, and interaction patterns.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Location Data:</strong> Approximate location based on device settings, if enabled.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Security Data:</strong> Authentication logs, access attempts, and fraud‑prevention metadata.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                2. How We Use Your Information
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>To create and manage accounts.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>To provide, maintain, and improve the Liberty Social platform.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>To personalize your experience.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>To support security, verification, and fraud detection.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>To communicate with you regarding updates, notifications, or support requests.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>To enforce platform rules and protect user safety.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                3. How We Share Information
              </h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                We do <strong>NOT</strong> sell your data. We may share information only in the following cases:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>With service providers who support platform operations (hosting, security, analytics).</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>With law enforcement if legally required.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>With other users, only to the extent necessary for platform functionality (profile display, friend requests, messaging).</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>In connection with mergers, acquisitions, or platform transfer.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                4. Data Security
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We use encryption, secure servers, and industry‑standard protections to safeguard your information. While we take all reasonable measures, no system is 100% secure.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                5. Data Retention
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We retain user information for as long as required to operate the platform, comply with law, or resolve disputes. Users may request account deletion at any time.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                6. Your Rights
              </h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                Depending on your jurisdiction, you may have rights to:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Access your data</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Correct inaccurate information</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Request deletion</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Restrict or object to processing</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                7. Cookies and Tracking Technologies
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Liberty Social uses cookies and similar tools to improve user experience, authenticate sessions, and analyze performance.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                8. Children's Privacy
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Liberty Social does not knowingly collect data from children under 13. If we become aware of such data, it will be deleted immediately.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                9. Changes to This Policy
              </h2>
              <p className="text-gray-700 leading-relaxed">
                We may update this Privacy Policy as needed. Continued use of Liberty Social constitutes acceptance of any modifications.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                10. Contact Information
              </h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                For privacy questions or requests:
              </p>
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <p className="text-gray-700 font-semibold mb-2">Liberty Social</p>
                <p className="text-gray-700 mb-1">Attn: Privacy Office</p>
                <p className="text-gray-700 mb-1">PO Box 52</p>
                <p className="text-gray-700 mb-4">Detroit, ME 04929</p>
                <p className="text-gray-700">
                  Email: <a href="mailto:nathan@membershipauto.com" className="text-primary hover:underline font-semibold">nathan@membershipauto.com</a>
                </p>
              </div>
            </section>
          </div>
        </div>

        {/* Additional Help Section */}
        <div className="mt-12 bg-primary/5 rounded-xl p-8 text-center border border-primary/10">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Questions about your privacy?
          </h2>
          <p className="text-gray-600 mb-6">
            If you have any questions or concerns about this Privacy Policy or our data practices, please contact us.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:nathan@membershipauto.com"
              className="inline-block btn-primary text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-metallic"
            >
              Contact Privacy Office
            </a>
            {isAuthenticated ? (
              <Link
                href="/app/settings"
                className="inline-block bg-white text-primary font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-md border border-primary/20"
              >
                Account Settings
              </Link>
            ) : (
              <Link
                href="/auth"
                className="inline-block bg-white text-primary font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-md border border-primary/20"
              >
                Sign In
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

