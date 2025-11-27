"use client";

import { useAuth } from "@/lib/auth-context";
import Link from "next/link";

export default function FAQPage() {
  const { isAuthenticated } = useAuth();

  const faqCategories = [
    {
      title: "Getting Started",
      questions: [
        {
          q: "How do I create an account?",
          a: "You can create an account by clicking the 'Sign Up' button on the homepage. You'll need to provide your email address, create a password, and fill in some basic information about yourself.",
        },
        {
          q: "How do I verify my email?",
          a: "After signing up, you'll receive a verification email. Click the link in the email to verify your account. If you don't see the email, check your spam folder.",
        },
        {
          q: "Can I use social login?",
          a: "Yes! You can sign up or log in using your Google or Facebook account for a quicker registration process.",
        },
      ],
    },
    {
      title: "Profile & Privacy",
      questions: [
        {
          q: "How do I update my profile?",
          a: "Go to your profile page and click the 'Edit' button. You can update your name, bio, profile picture, and other information from there.",
        },
        {
          q: "How do I control who can see my profile?",
          a: "Navigate to Settings > Privacy to adjust your profile visibility. You can set it to Public, Friends only, or Only me.",
        },
        {
          q: "Can I make my friend list private?",
          a: "Yes, in the Privacy settings, you can control who can see your friend list. Options include Public, Friends only, or Only me.",
        },
        {
          q: "How do I block someone?",
          a: "Visit the user's profile and click the options menu (three dots), then select 'Block User'. You can manage blocked users in Settings.",
        },
      ],
    },
    {
      title: "Posts & Content",
      questions: [
        {
          q: "How do I create a post?",
          a: "Click the 'Create Post' button in the feed or on your profile. You can add text, images, and videos to your post before publishing.",
        },
        {
          q: "Can I edit or delete my posts?",
          a: "Yes, you can edit or delete your posts by clicking the options menu (three dots) on any of your posts and selecting the appropriate action.",
        },
        {
          q: "How do I react to a post?",
          a: "You can like a post by clicking the heart icon, or long-press to see advanced reaction options including emoji reactions.",
        },
        {
          q: "How do I bookmark a post?",
          a: "Click the options menu (three dots) on any post and select 'Bookmark'. You can view all your bookmarked posts in Settings > Saved Posts.",
        },
        {
          q: "Can I share posts?",
          a: "Yes, click the share icon on any post to share it with others. You can share via link or through other platforms.",
        },
      ],
    },
    {
      title: "Pages",
      questions: [
        {
          q: "What are Pages?",
          a: "Pages are community spaces where you can share content, connect with like-minded people, and build communities around shared interests.",
        },
        {
          q: "How do I create a Page?",
          a: "Go to the Pages section and click the 'Create Page' button. Fill in the page name, description, and upload a profile image.",
        },
        {
          q: "How do I invite people to my Page?",
          a: "On your page, click the 'Invite' button to search for and invite users. You can also send admin invites to grant management permissions.",
        },
        {
          q: "Can I follow Pages?",
          a: "Yes! Click the 'Follow' button on any page to see their posts in your feed. You can unfollow at any time.",
        },
      ],
    },
    {
      title: "Friends & Connections",
      questions: [
        {
          q: "How do I send a friend request?",
          a: "Visit a user's profile and click the 'Send Friend Request' button. They'll receive a notification and can accept or decline.",
        },
        {
          q: "Where can I see my friend requests?",
          a: "Go to the Friend Requests section to see incoming and outgoing friend requests. You can accept, decline, or cancel requests from there.",
        },
        {
          q: "How do I unfriend someone?",
          a: "Visit their profile, click the options menu, and select 'Unfriend'. This will remove them from your friend list.",
        },
      ],
    },
    {
      title: "Messaging",
      questions: [
        {
          q: "How do I send a message?",
          a: "Go to the Messages section, select a conversation, or start a new one by clicking 'New Message'. Type your message and click send.",
        },
        {
          q: "Can I send images or videos in messages?",
          a: "Yes! Click the attachment icon in the message input to select and send images or videos from your device.",
        },
        {
          q: "How do I start a conversation with someone?",
          a: "Visit their profile and click 'Send Message', or go to Messages and click 'New Message' to search for the user.",
        },
      ],
    },
    {
      title: "Marketplace",
      questions: [
        {
          q: "How do I create a marketplace listing?",
          a: "Go to Marketplace and click 'Create Listing'. Fill in the details including title, description, price, location, and upload images.",
        },
        {
          q: "Can I save listings I'm interested in?",
          a: "Yes! Click the bookmark icon on any listing to save it. View all your saved listings in the Marketplace section.",
        },
        {
          q: "How do I make an offer on a listing?",
          a: "Visit the listing detail page and click 'Make Offer'. Enter your offer amount and submit. The seller will be notified.",
        },
        {
          q: "Can I edit or delete my listings?",
          a: "Yes, on your own listings, click the options menu (three dots) and select 'Edit' or 'Delete'.",
        },
      ],
    },
    {
      title: "Account & Settings",
      questions: [
        {
          q: "How do I change my password?",
          a: "Go to Settings > Account and click 'Change Password'. You'll need to enter your current password and create a new one.",
        },
        {
          q: "How do I update my email?",
          a: "Navigate to Settings > Account and update your email address. You'll need to verify the new email address.",
        },
        {
          q: "Can I delete my account?",
          a: "Yes, you can delete your account from Settings > Account. This action is permanent and cannot be undone.",
        },
        {
          q: "How do I report a bug?",
          a: "Go to Settings and scroll to the 'Report Bug' section. Fill in the details and optionally attach a screenshot. Our team will review it.",
        },
      ],
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-white safe-pt safe-px safe-pb">
      <div className="max-w-4xl mx-auto py-12 px-6">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">
            Frequently Asked Questions
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Find answers to common questions about using Liberty Social. Can't find what you're looking for?{" "}
            {isAuthenticated ? (
              <Link href="/app/settings" className="text-primary hover:underline font-semibold">
                Contact us
              </Link>
            ) : (
              <a href="mailto:support@mylibertysocial.com" className="text-primary hover:underline font-semibold">
                Contact us
              </a>
            )}
          </p>
        </div>

        {/* FAQ Categories */}
        <div className="space-y-8">
          {faqCategories.map((category, categoryIndex) => (
            <div key={categoryIndex} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 md:p-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-6 pb-3 border-b border-gray-200">
                {category.title}
              </h2>
              <div className="space-y-6">
                {category.questions.map((item, itemIndex) => (
                  <div key={itemIndex} className="border-b border-gray-100 last:border-0 pb-6 last:pb-0">
                    <h3 className="text-lg font-semibold text-gray-900 mb-2">
                      {item.q}
                    </h3>
                    <p className="text-gray-600 leading-relaxed">
                      {item.a}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Additional Help Section */}
        <div className="mt-12 bg-primary/5 rounded-xl p-8 text-center border border-primary/10">
          <h2 className="text-2xl font-bold text-gray-900 mb-3">
            Still need help?
          </h2>
          <p className="text-gray-600 mb-6">
            Our support team is here to assist you with any questions or issues.
          </p>
          {isAuthenticated ? (
            <Link
              href="/app/settings"
              className="inline-block btn-primary text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-metallic"
            >
              Go to Settings
            </Link>
          ) : (
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <a
                href="mailto:support@mylibertysocial.com"
                className="inline-block btn-primary text-white font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-metallic"
              >
                Email Support
              </a>
              <Link
                href="/auth"
                className="inline-block bg-white text-primary font-semibold px-8 py-3 rounded-xl hover:opacity-90 transition shadow-md border border-primary/20"
              >
                Sign In
              </Link>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

