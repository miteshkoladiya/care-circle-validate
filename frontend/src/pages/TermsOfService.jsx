import React from "react";
import { PublicNavbar } from "@/components/Layout/PublicNavbar";
import { Footer } from "@/components/Layout/Footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-background flex flex-col">
      <PublicNavbar />
      <div className="container mx-auto p-6 flex-1">
        <Card className="max-w-4xl mx-auto shadow-sm">
          <CardHeader>
            <CardTitle className="text-3xl font-bold text-primary">Terms of Service</CardTitle>
          </CardHeader>
          <CardContent className="prose prose-slate dark:prose-invert max-w-none space-y-4">
            {/* <p className="text-muted-foreground">Last updated: {new Date().toLocaleDateString()}</p> */}
            
            <section>
              <h2 className="text-xl font-semibold mb-2">1. Acceptance of Terms</h2>
              <p>
                By accessing and using CareCircle ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. In addition, when using these particular services, you shall be subject to any posted guidelines or rules applicable to such services.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">2. Medical Disclaimer</h2>
              <p className="font-medium text-red-600/80 dark:text-red-400">
                CareCircle is for informational purposes only and does not constitute medical advice.
              </p>
              <p>
                Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read on CareCircle.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">3. User Conduct</h2>
              <p>
                You agree not to use the Service to:
              </p>
              <ul className="list-disc pl-6 space-y-1">
                <li>Upload, post, or transmit any content that is unlawful, harmful, threatening, abusive, harassing, tortious, defamatory, vulgar, obscene, libelous, invasive of another's privacy, hateful, or racially, ethnically or otherwise objectionable.</li>
                <li>Impersonate any person or entity, including, but not limited to, a CareCircle official, forum leader, guide or host, or falsely state or otherwise misrepresent your affiliation with a person or entity.</li>
                <li>Upload, post, or transmit any content that you do not have a right to transmit under any law or under contractual or fiduciary relationships.</li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">4. Modifications to Service</h2>
              <p>
                CareCircle reserves the right at any time and from time to time to modify or discontinue, temporarily or permanently, the Service (or any part thereof) with or without notice. You agree that CareCircle shall not be liable to you or to any third party for any modification, suspension or discontinuance of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold mb-2">5. Governing Law</h2>
              <p>
                These Terms shall be governed and construed in accordance with the laws, without regard to its conflict of law provisions.
              </p>
            </section>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
}
