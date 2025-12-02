"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function TermsPage() {
  const { isAuthenticated } = useAuth();

  return (
    <div className="min-h-screen bg-linear-to-br from-gray-50 to-white safe-pt safe-px safe-pb">
      <div className="max-w-4xl mx-auto py-12 px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Terms of Service
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Last updated: {new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
          </p>
        </div>

        {/* Terms of Service Content */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8 space-y-8">
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-700 leading-relaxed">
              Welcome to Liberty Social. By accessing or using our platform, you agree to be bound by these Terms of Service ("Terms"). Please read them carefully before using Liberty Social.
            </p>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                1. Acceptance of Terms
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                By creating an account, accessing, or using Liberty Social, you agree to:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Comply with these Terms and all applicable laws and regulations.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Accept our <Link href="/privacy" className="text-primary hover:underline font-semibold">Privacy Policy</Link>.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Use the platform responsibly and lawfully.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                2. Eligibility
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>You must be at least <strong>13 years old</strong> to use Liberty Social.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>You must provide accurate and complete registration information.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>You are responsible for maintaining the security of your account credentials.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>You may not create multiple accounts or impersonate others.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                3. User Conduct and Prohibited Activities
              </h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                You agree <strong>NOT</strong> to:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Post or share illegal, harmful, abusive, harassing, threatening, or defamatory content.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Engage in spam, phishing, or fraudulent activities.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Upload malware, viruses, or malicious code.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Violate intellectual property rights of others.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Scrape, harvest, or collect user data without authorization.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Bypass security measures or attempt unauthorized access.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Use automated systems (bots) without permission.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                4. User Content
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Ownership:</strong> You retain ownership of content you post, but grant Liberty Social a non-exclusive, royalty-free license to use, display, and distribute your content on the platform.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Responsibility:</strong> You are solely responsible for the content you post and any consequences arising from it.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Moderation:</strong> Liberty Social reserves the right to remove content that violates these Terms or community guidelines.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Backup:</strong> We are not responsible for loss of content. You should maintain your own backups.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                5. Intellectual Property
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Liberty Social and its logos, features, and functionality are owned by Liberty Social and protected by copyright, trademark, and other intellectual property laws.
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>You may not copy, modify, or distribute platform content without authorization.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Trademarks and service marks may not be used without written permission.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                6. Account Termination and Suspension
              </h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                Liberty Social reserves the right to:
              </p>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Suspend or terminate accounts that violate these Terms.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Remove content at our discretion.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Refuse service to anyone at any time.</span>
                </li>
              </ul>
              <p className="text-gray-700 leading-relaxed mt-4">
                Users may delete their accounts at any time through account settings.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                7. Privacy and Data Security
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Your use of Liberty Social is governed by our <Link href="/privacy" className="text-primary hover:underline font-semibold">Privacy Policy</Link>, which explains how we collect, use, and protect your information.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                8. Disclaimers and Limitations of Liability
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>"AS IS" Service:</strong> Liberty Social is provided "as is" without warranties of any kind, express or implied.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>No Guarantee:</strong> We do not guarantee uninterrupted, error-free, or secure service.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>Limitation:</strong> Liberty Social is not liable for indirect, incidental, consequential, or punitive damages arising from your use of the platform.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span><strong>User Interactions:</strong> We are not responsible for interactions, disputes, or conduct between users.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                9. Indemnification
              </h2>
              <p className="text-gray-700 leading-relaxed">
                You agree to indemnify and hold Liberty Social harmless from any claims, damages, losses, or expenses (including legal fees) arising from your use of the platform, violation of these Terms, or infringement of any third-party rights.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                10. Third-Party Links and Services
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Liberty Social may contain links to third-party websites or services. We are not responsible for their content, privacy practices, or terms. Use them at your own risk.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                11. Modifications to Terms
              </h2>
              <p className="text-gray-700 leading-relaxed">
                Liberty Social reserves the right to modify these Terms at any time. Continued use of the platform after changes constitutes acceptance of the updated Terms. We will notify users of significant changes.
              </p>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                12. Governing Law and Dispute Resolution
              </h2>
              <ul className="space-y-3 text-gray-700">
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>These Terms are governed by the laws of the State of Maine, United States.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>Any disputes will be resolved through binding arbitration in accordance with Maine law.</span>
                </li>
                <li className="flex items-start">
                  <span className="text-primary mr-2">•</span>
                  <span>You waive your right to participate in class action lawsuits.</span>
                </li>
              </ul>
            </section>

            <section className="mt-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 pb-3 border-b border-gray-200">
                13. Contact Information
              </h2>
              <p className="text-gray-700 mb-4 leading-relaxed">
                For questions about these Terms:
              </p>
              <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
                <p className="text-gray-700 font-semibold mb-2">Liberty Social</p>
                <p className="text-gray-700 mb-1">Attn: Legal Department</p>
                <p className="text-gray-700 mb-1">PO Box 52</p>
                <p className="text-gray-700 mb-4">Detroit, ME 04929</p>
                <p className="text-gray-700">
                  Email: <a href="mailto:nathan@membershipauto.com" className="text-primary hover:underline font-semibold">nathan@membershipauto.com</a>
                </p>
              </div>
            </section>

            <section className="mt-8 bg-primary/5 rounded-lg p-6 border border-primary/10">
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                Agreement
              </h3>
              <p className="text-gray-700 leading-relaxed">
                By using Liberty Social, you acknowledge that you have read, understood, and agree to be bound by these Terms of Service.
              </p>
            </section>
          </div>
        </div>

        {/* Additional Help Section */}
        <div className="mt-12 bg-primary/5 rounded-xl p-8 text-center border border-primary/10">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Questions about our Terms?
          </h2>
          <p className="text-gray-600 mb-6">
            If you have any questions or concerns about these Terms of Service, please contact us.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="mailto:nathan@membershipauto.com"
              className="inline-block btn-primary text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-metallic"
            >
              Contact Legal Department
            </a>
            <Link
              href="/privacy"
              className="inline-block bg-white text-primary font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-md border border-primary/20"
            >
              Privacy Policy
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
