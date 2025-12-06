import React from "react";
import { PublicNavbar } from "@/components/Layout/PublicNavbar";
import { Footer } from "@/components/Layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicNavbar />
      <div className="container mx-auto p-6 flex-1">
        <Card className="max-w-4xl mx-auto shadow-sm">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary">Privacy Policy</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            {/* <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p> */}
            
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Information We Collect</h2>
              <p>
                We collect information you provide directly to us, such as when you create an account, update your profile, post content, or communicate with us. This may include your name, email address, and any other information you choose to provide.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. How We Use Your Information</h2>
              <p>
                We use the information we collect to:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Provide, maintain, and improve our services.</li>
                <li>Process transactions and send related information.</li>
                <li>Send you technical notices, updates, security alerts, and support and administrative messages.</li>
                <li>Respond to your comments, questions, and requests.</li>
                <li>Monitor and analyze trends, usage, and activities in connection with our services.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. Information Sharing</h2>
              <p>
                We do not share your personal information with third parties except as described in this policy. We may share your information with:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Service providers who need access to such information to carry out work on our behalf.</li>
                <li>In response to a request for information if we believe disclosure is in accordance with any applicable law, regulation, or legal process.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Data Security</h2>
              <p>
                We take reasonable measures to help protect information about you from loss, theft, misuse and unauthorized access, disclosure, alteration and destruction.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Contact Us</h2>
              <p>
                If you have any questions about this Privacy Policy, please contact us at support@carecircle.com.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
