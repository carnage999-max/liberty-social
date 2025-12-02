export default function SafetyPage() {
  return (
    <div className="min-h-screen bg-white dark:bg-slate-900 px-4 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white mb-4">
            Child Safety Standards
          </h1>
          <p className="text-lg text-slate-600 dark:text-slate-300">
            Liberty Social is committed to protecting children and preventing child sexual abuse and exploitation (CSAE).
          </p>
        </div>

        {/* Safety Measures */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Our Safety Measures
          </h2>
          <ul className="space-y-4">
            <li className="flex items-start gap-4">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Age Verification</h3>
                <p className="text-slate-600 dark:text-slate-300">Minimum age requirement of 13 years for account creation and verification of user age</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Content Moderation</h3>
                <p className="text-slate-600 dark:text-slate-300">Automated systems to detect and remove harmful, explicit, and exploitative content</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">User Reporting Tools</h3>
                <p className="text-slate-600 dark:text-slate-300">In-app reporting feature for users to report inappropriate content, behavior, and child safety concerns</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Swift Response</h3>
                <p className="text-slate-600 dark:text-slate-300">Rapid investigation and response to all reports of child safety concerns and policy violations</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Messaging Protection</h3>
                <p className="text-slate-600 dark:text-slate-300">Restricted messaging between unverified users and minors to prevent predatory contact</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">CSAM Detection</h3>
                <p className="text-slate-600 dark:text-slate-300">Automated detection and removal of known child sexual abuse material (CSAM) using industry-standard tools</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Regular Audits</h3>
                <p className="text-slate-600 dark:text-slate-300">Continuous safety audits, updates, and compliance reviews to maintain the highest standards</p>
              </div>
            </li>
            <li className="flex items-start gap-4">
              <span className="text-green-600 dark:text-green-400 font-bold text-xl">✓</span>
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">Educational Resources</h3>
                <p className="text-slate-600 dark:text-slate-300">Information and resources for users and parents about online safety and recognizing harmful behavior</p>
              </div>
            </li>
          </ul>
        </section>

        {/* Reporting */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            How to Report Concerns
          </h2>
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-6">
            <p className="text-slate-700 dark:text-slate-300 mb-4">
              If you encounter child safety concerns, inappropriate content, or suspected exploitation on Liberty Social:
            </p>
            <ul className="space-y-3 text-slate-700 dark:text-slate-300">
              <li>• Use the in-app reporting feature available on all content and profiles</li>
              <li>• Email us directly at: <a href="mailto:nathan@membershipauto.com" className="text-blue-600 dark:text-blue-400 underline">nathan@membershipauto.com</a></li>
              <li>• Contact the National Center for Missing & Exploited Children (NCMEC) at <a href="https://www.cybertipline.org" target="_blank" rel="noopener noreferrer" className="text-blue-600 dark:text-blue-400 underline">CyberTipline.org</a></li>
              <li>• Report to local law enforcement if appropriate</li>
            </ul>
          </div>
        </section>

        {/* Compliance */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-6">
            Legal Compliance
          </h2>
          <div className="space-y-4 text-slate-600 dark:text-slate-300">
            <p>
              Liberty Social complies with all relevant child safety laws and regulations, including but not limited to:
            </p>
            <ul className="space-y-2 ml-4">
              <li>• Children's Online Privacy Protection Act (COPPA)</li>
              <li>• Age-Appropriate Design Code (UK)</li>
              <li>• Digital Services Act (EU)</li>
              <li>• Online Safety Bill requirements</li>
              <li>• State and local child protection laws</li>
            </ul>
            <p className="mt-6">
              We maintain comprehensive records of safety incidents and report to relevant regional and national authorities as required by law.
            </p>
          </div>
        </section>

        {/* Contact */}
        <section className="bg-slate-50 dark:bg-slate-800 rounded-lg p-8">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-4">
            Contact Us
          </h2>
          <p className="text-slate-600 dark:text-slate-300 mb-4">
            For questions about our child safety practices and compliance:
          </p>
          <div className="space-y-2 text-slate-700 dark:text-slate-300">
            <p>
              <strong>Email:</strong> <a href="mailto:nathan@membershipauto.com" className="text-blue-600 dark:text-blue-400 underline">nathan@membershipauto.com</a>
            </p>
            <p>
              <strong>Physical Address:</strong><br />
              Liberty Social<br />
              PO Box 52<br />
              Detroit, ME 04929<br />
              USA
            </p>
          </div>
        </section>

        {/* Last Updated */}
        <div className="mt-12 pt-6 border-t border-slate-200 dark:border-slate-700">
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Last updated: December 2, 2025
          </p>
        </div>
      </div>
    </div>
  );
}
