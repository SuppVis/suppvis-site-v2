import type { Metadata } from "next";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Terms of Service - SuppVis",
  description:
    "Terms of Service governing your use of SuppVis and related services.",
};

export default function TermsPage() {
  return (
    <>
      <Nav />
      <main className="pt-32 md:pt-40 pb-24 px-6">
        <article className="max-w-[760px] mx-auto">
          <h1 className="font-headline font-extrabold text-3xl sm:text-4xl md:text-5xl text-text-primary mb-4 leading-tight">
            Terms of Service
          </h1>
          <p className="text-text-muted text-sm mb-12">
            Effective date: July 10, 2026
          </p>

          <div className="space-y-10 text-[15px] text-text-secondary leading-[1.75]">
            <p>
              Welcome to SuppVis. These Terms of Service (&ldquo;Terms&rdquo;)
              govern your access to and use of the SuppVis iOS application,
              website at suppvis.health, and related services (collectively, the
              &ldquo;Services&rdquo;), operated by SuppVis LLC
              (&ldquo;SuppVis,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;).
            </p>
            <p>
              Please read these Terms carefully. By creating an account or using
              the Services, you agree to these Terms and our{" "}
              <a
                href="/privacy"
                className="text-accent hover:text-accent-hover transition-colors"
              >
                Privacy Policy
              </a>
              . These Terms include a binding arbitration agreement and class
              action waiver in Section 14 that affects your legal rights. If you
              do not agree to any part of these Terms, do not use the Services.
            </p>

            {/* Section 1 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                1. Eligibility
              </h2>
              <p className="mb-4">
                You must be at least 18 years old to use SuppVis. By creating an
                account, you represent that you are 18 or older, that the
                information you provide about yourself is accurate, and that you
                have the legal capacity to enter into these Terms.
              </p>
              <p>
                If you are pregnant, nursing, taking prescription medications, or
                managing a medical condition, you should consult a qualified
                healthcare provider before using SuppVis to inform any supplement
                decision.
              </p>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                2. The Services
              </h2>
              <p className="mb-4">
                SuppVis is a personalized supplement information and
                recommendation platform. Based on the health information you
                provide, our system retrieves evidence-based recommendations from
                a curated dataset of supplements, conditions, and research. Our
                recommendation engine generates personalized stacks for you,
                screens those recommendations against the medications and
                conditions you have logged, and uses artificial intelligence to
                generate written explanations and educational content around each
                recommendation.
              </p>
              <p>
                The Services are provided for general wellness and informational
                purposes only. They are not a medical service, do not constitute
                the practice of medicine, and are not intended to diagnose,
                treat, cure, or prevent any disease.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                3. Health Disclaimer and Limitations of the Services
              </h2>
              <div className="space-y-4">
                <p>
                  <strong className="text-text-primary">
                    Not medical advice.
                  </strong>{" "}
                  SuppVis does not provide medical advice, diagnosis, or
                  treatment. Information provided through the Services, including
                  personalized recommendations, supplement explanations, research
                  summaries, and goal scoring, is for informational and
                  educational purposes only. Always consult a qualified
                  healthcare provider before starting, stopping, or changing any
                  supplement, especially if you have a medical condition, take
                  prescription medications, are pregnant or nursing, or are under
                  the care of a healthcare provider.
                </p>
                <p>
                  <strong className="text-text-primary">
                    FDA disclosure.
                  </strong>{" "}
                  Statements about supplements made through the Services have not
                  been evaluated by the United States Food and Drug
                  Administration. Dietary supplements are not intended to
                  diagnose, treat, cure, or prevent any disease. Individual
                  results vary.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Interaction screening limitations.
                  </strong>{" "}
                  SuppVis screens recommendations against the medications and
                  conditions you have logged in the Services. This screening is
                  only as complete as the information you provide. SuppVis cannot
                  screen against medications, conditions, allergies, or other
                  health information you have not disclosed. Interaction
                  screening is a tool to support informed decisions and is not a
                  substitute for the judgment of a qualified healthcare provider,
                  who has access to your full medical history and can interpret
                  risk in context.
                </p>
                <p>
                  <strong className="text-text-primary">
                    No guarantee of outcomes.
                  </strong>{" "}
                  SuppVis does not guarantee any specific health outcome from
                  following our recommendations. Supplement effectiveness varies
                  between individuals based on biology, lifestyle, diet,
                  medication interactions, condition severity, supplement
                  quality, and many other factors outside our control.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Not for emergencies.
                  </strong>{" "}
                  Do not use SuppVis for medical emergencies. If you believe you
                  are experiencing a medical emergency, call your local emergency
                  number or seek immediate medical attention.
                </p>
              </div>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                4. Your Account
              </h2>
              <p className="mb-4">
                You must provide accurate and complete information when creating
                your account, and you must keep that information current. You are
                responsible for maintaining the confidentiality of your login
                credentials and for all activity under your account. Notify us
                promptly at{" "}
                <a
                  href="mailto:terms@suppvis.health"
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  terms@suppvis.health
                </a>{" "}
                if you suspect unauthorized access.
              </p>
              <p className="mb-4">
                You may not share your account, transfer it, or allow another
                person to use it on your behalf. Each person using SuppVis must
                maintain their own account.
              </p>
              <p>
                You are responsible for the accuracy of the health information
                you enter into SuppVis, including conditions, medications,
                allergies, and goals. Inaccurate or incomplete information will
                produce inaccurate recommendations and may cause our interaction
                screening to miss real risks.
              </p>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                5. Acceptable Use
              </h2>
              <p className="mb-4">You agree not to:</p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>
                  Use the Services in violation of any law or regulation
                </li>
                <li>
                  Use the Services to provide medical advice to other people
                </li>
                <li>
                  Submit false health information for the purpose of obtaining
                  recommendations not appropriate for your actual situation
                </li>
                <li>
                  Attempt to reverse engineer, extract, or replicate our
                  recommendation engine, scoring models, or curated dataset
                </li>
                <li>
                  Use automated tools to scrape, harvest, or extract data from
                  the Services
                </li>
                <li>
                  Attempt to extract training data, system prompts, or
                  proprietary information from any AI features
                </li>
                <li>
                  Interfere with the Services&rsquo; security or integrity,
                  including by introducing malware, exploiting vulnerabilities,
                  or attempting unauthorized access
                </li>
                <li>
                  Resell, sublicense, or commercially exploit the Services or
                  the content within them
                </li>
                <li>
                  Use the Services in any way that infringes the rights of
                  others, including intellectual property rights and rights of
                  privacy
                </li>
              </ul>
              <p>
                We may suspend or terminate accounts that violate this section.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                6. Affiliate Relationships and Commercial Arrangements
              </h2>
              <p className="mb-4">
                SuppVis earns revenue in part through affiliate relationships and
                commercial partnerships with supplement manufacturers and
                retailers. This means:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>
                  We participate in the Amazon Associates Program and similar
                  affiliate programs. When you click a product link and make a
                  qualifying purchase, we may receive a commission at no
                  additional cost to you.
                </li>
                <li>
                  We may have direct partnerships with supplement brands. In
                  some cases, partner brands may receive prominent placement in
                  non-personalized surfaces of the Services such as the shop,
                  browse pages, or featured product sections. Where this occurs,
                  we will identify these placements as sponsored, partnered, or
                  otherwise commercial.
                </li>
                <li>
                  <strong className="text-text-primary">
                    Personalized recommendations are not paid placements.
                  </strong>{" "}
                  When SuppVis generates a recommendation specifically for you
                  based on your health profile, conditions, medications, and
                  goals, that recommendation is generated by our recommendation
                  engine based on the underlying evidence. Brands cannot pay to
                  be recommended to a specific user.
                </li>
              </ul>
              <p>
                We will continue to update these arrangements over time and will
                disclose them in accordance with applicable law and FTC guidance.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                7. Intellectual Property
              </h2>
              <div className="space-y-4">
                <p>
                  <strong className="text-text-primary">Our content.</strong>{" "}
                  SuppVis and its licensors own all rights in the Services and
                  the content we provide, including the recommendation engine,
                  scoring models, curated dataset, software, design, written
                  explanations, research summaries, branding, and any
                  AI-generated content. You may not copy, modify, distribute,
                  sell, or create derivative works without our written
                  permission, except as permitted by these Terms.
                </p>
                <p>
                  <strong className="text-text-primary">Your content.</strong>{" "}
                  You retain ownership of the health information, supplement
                  logs, check-in responses, and other personal data you submit
                  to SuppVis. By submitting this content, you grant SuppVis a
                  worldwide, non-exclusive, royalty-free license to use, store,
                  process, and display this content as needed to provide the
                  Services to you, improve the Services, and create anonymized
                  and aggregated datasets as described in our Privacy Policy.
                </p>
                <p>
                  <strong className="text-text-primary">Feedback.</strong> If
                  you send us suggestions, ideas, or feedback about the
                  Services, we may use them without restriction or compensation
                  to you.
                </p>
              </div>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                8. Third-Party Services and Links
              </h2>
              <p>
                SuppVis integrates with and links to third-party services,
                including AI providers, affiliate retailers, and supplement
                manufacturers. We do not control these third parties and are not
                responsible for their content, products, services, privacy
                practices, or business practices. Your interactions with third
                parties are governed by their own terms and policies.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                9. Modifications to the Services
              </h2>
              <p>
                We may add, remove, or change features of the Services at any
                time. We may also discontinue the Services in whole or in part.
                We will provide reasonable notice of material changes that
                significantly impact existing users.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                10. Termination
              </h2>
              <div className="space-y-4">
                <p>
                  <strong className="text-text-primary">By you.</strong> You may
                  close your account at any time through the app settings or by
                  contacting{" "}
                  <a
                    href="mailto:privacy@suppvis.health"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    privacy@suppvis.health
                  </a>
                  . Upon closure, your data will be handled as described in our
                  Privacy Policy.
                </p>
                <p>
                  <strong className="text-text-primary">By us.</strong> We may
                  suspend or terminate your access to the Services at any time,
                  with or without notice, if we reasonably believe you have
                  violated these Terms, if your use of the Services creates
                  legal or security risk, or if continued service is no longer
                  commercially viable. Where practical, we will provide notice
                  and an opportunity to address the issue.
                </p>
                <p>
                  <strong className="text-text-primary">Survival.</strong>{" "}
                  Sections that by their nature should survive termination will
                  survive, including Sections 3 (Health Disclaimer), 7
                  (Intellectual Property), 11 (Disclaimers), 12 (Limitation of
                  Liability), 13 (Indemnification), 14 (Dispute Resolution), and
                  15 (General).
                </p>
              </div>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                11. Disclaimers
              </h2>
              <div className="space-y-4 uppercase text-xs tracking-wide leading-[1.9]">
                <p>
                  THE SERVICES ARE PROVIDED ON AN &ldquo;AS IS&rdquo; AND
                  &ldquo;AS AVAILABLE&rdquo; BASIS. TO THE FULLEST EXTENT
                  PERMITTED BY LAW, SUPPVIS DISCLAIMS ALL WARRANTIES, EXPRESS OR
                  IMPLIED, INCLUDING IMPLIED WARRANTIES OF MERCHANTABILITY,
                  FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ANY
                  WARRANTIES ARISING FROM COURSE OF DEALING OR USAGE OF TRADE.
                </p>
                <p>
                  WE DO NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED,
                  SECURE, ERROR-FREE, OR THAT RECOMMENDATIONS WILL BE COMPLETE,
                  CURRENT, OR APPROPRIATE FOR YOUR SPECIFIC HEALTH SITUATION. WE
                  DO NOT WARRANT ANY SPECIFIC HEALTH OUTCOME FROM USING THE
                  SERVICES.
                </p>
              </div>
              <p className="mt-4">
                Some jurisdictions do not allow the exclusion of certain
                warranties. In those jurisdictions, the disclaimers above apply
                to the maximum extent permitted by law.
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                12. Limitation of Liability
              </h2>
              <div className="space-y-4 uppercase text-xs tracking-wide leading-[1.9]">
                <p>
                  TO THE FULLEST EXTENT PERMITTED BY LAW, SUPPVIS AND ITS
                  OFFICERS, DIRECTORS, EMPLOYEES, CONTRACTORS, AND AGENTS WILL
                  NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL,
                  CONSEQUENTIAL, EXEMPLARY, OR PUNITIVE DAMAGES, OR FOR ANY LOSS
                  OF PROFITS, REVENUE, DATA, OR USE, ARISING OUT OF OR RELATED
                  TO YOUR USE OF THE SERVICES, WHETHER BASED ON WARRANTY,
                  CONTRACT, TORT, NEGLIGENCE, OR ANY OTHER LEGAL THEORY, EVEN IF
                  WE HAVE BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
                </p>
                <p>
                  OUR TOTAL CUMULATIVE LIABILITY TO YOU FOR ALL CLAIMS ARISING
                  OUT OF OR RELATED TO THE SERVICES OR THESE TERMS WILL NOT
                  EXCEED THE GREATER OF THE AMOUNT YOU PAID TO SUPPVIS IN THE
                  TWELVE MONTHS PRECEDING THE EVENT GIVING RISE TO THE CLAIM, OR
                  ONE THOUSAND DOLLARS ($1,000).
                </p>
              </div>
              <p className="mt-4">
                The limitations in this section do not apply to liability that
                cannot be excluded under applicable law, including liability for
                gross negligence, willful misconduct, or fraud.
              </p>
            </section>

            {/* Section 13 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                13. Indemnification
              </h2>
              <p>
                You agree to indemnify and hold harmless SuppVis and its
                officers, directors, employees, and agents from any claims,
                liabilities, damages, losses, and expenses (including reasonable
                attorneys&rsquo; fees) arising out of or related to your use of
                the Services, your violation of these Terms, your violation of
                any rights of another person or entity, or any health decisions
                you make based on information from the Services.
              </p>
            </section>

            {/* Section 14 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                14. Dispute Resolution and Arbitration
              </h2>
              <div className="space-y-4">
                <p>
                  <strong className="text-text-primary">
                    Informal resolution first.
                  </strong>{" "}
                  If you have a dispute with SuppVis, contact us at{" "}
                  <a
                    href="mailto:terms@suppvis.health"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    terms@suppvis.health
                  </a>{" "}
                  and we will attempt to resolve it in good faith for at least 60
                  days before either party initiates formal proceedings.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Binding arbitration.
                  </strong>{" "}
                  If we cannot resolve the dispute informally, you and SuppVis
                  agree to resolve any dispute arising out of or related to
                  these Terms or the Services through binding individual
                  arbitration administered by JAMS under its applicable rules.
                  Arbitration will take place in California, or by video
                  conference if you prefer, and will be conducted in English.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Class action waiver.
                  </strong>{" "}
                  You and SuppVis agree to bring any dispute in an individual
                  capacity only, not as a plaintiff or class member in any
                  class, collective, or representative proceeding. The
                  arbitrator may not consolidate claims and may not preside over
                  any class proceeding.
                </p>
                <p>
                  <strong className="text-text-primary">Exceptions.</strong>{" "}
                  Either party may bring an individual claim in small claims
                  court, and either party may seek injunctive relief in court
                  for intellectual property infringement or unauthorized access
                  to the Services.
                </p>
                <p>
                  <strong className="text-text-primary">Opt out.</strong> You
                  may opt out of this arbitration agreement by sending written
                  notice to{" "}
                  <a
                    href="mailto:terms@suppvis.health"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    terms@suppvis.health
                  </a>{" "}
                  within 30 days of first agreeing to these Terms. Your notice
                  must include your name, the email address associated with your
                  account, and a clear statement that you are opting out of
                  arbitration.
                </p>
                <p>
                  <strong className="text-text-primary">Governing law.</strong>{" "}
                  These Terms are governed by the laws of the State of
                  California, without regard to conflict of laws principles. To
                  the extent any dispute is not subject to arbitration, you and
                  SuppVis consent to the exclusive jurisdiction of the state and
                  federal courts located in California.
                </p>
              </div>
            </section>

            {/* Section 15 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                15. General
              </h2>
              <div className="space-y-4">
                <p>
                  <strong className="text-text-primary">
                    Entire agreement.
                  </strong>{" "}
                  These Terms and our Privacy Policy constitute the entire
                  agreement between you and SuppVis regarding the Services and
                  supersede any prior agreements.
                </p>
                <p>
                  <strong className="text-text-primary">Severability.</strong>{" "}
                  If any provision of these Terms is found unenforceable, the
                  remaining provisions will remain in full force and effect.
                </p>
                <p>
                  <strong className="text-text-primary">No waiver.</strong> Our
                  failure to enforce any provision of these Terms is not a
                  waiver of our right to enforce it later.
                </p>
                <p>
                  <strong className="text-text-primary">Assignment.</strong> You
                  may not assign your rights under these Terms without our
                  written consent. We may assign our rights and obligations
                  without restriction, including in connection with a sale,
                  merger, or acquisition.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Apple App Store.
                  </strong>{" "}
                  If you access the Services through the Apple App Store, you
                  acknowledge that these Terms are between you and SuppVis only,
                  not Apple, and that Apple is not responsible for the Services.
                  Apple is a third-party beneficiary of these Terms with the
                  right to enforce them against you.
                </p>
                <p>
                  <strong className="text-text-primary">
                    DMCA / Copyright.
                  </strong>{" "}
                  If you believe content on SuppVis infringes your copyright,
                  send a notice to{" "}
                  <a
                    href="mailto:privacy@suppvis.health"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    privacy@suppvis.health
                  </a>{" "}
                  that includes the information required by the Digital
                  Millennium Copyright Act.
                </p>
              </div>
            </section>

            {/* Section 16 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                16. Changes to These Terms
              </h2>
              <p>
                We may update these Terms from time to time. When we make
                material changes, we will notify registered users by email or
                through an in-app notice at least 30 days before changes take
                effect. Your continued use of the Services after the effective
                date of the updated Terms constitutes acceptance.
              </p>
            </section>

            {/* Section 17 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                17. Contact
              </h2>
              <address className="not-italic space-y-1 text-text-primary">
                <p>SuppVis LLC</p>
                <p>7486 La Jolla Blvd Suite 1044</p>
                <p>La Jolla, CA 92037</p>
                <p className="pt-2">
                  <a
                    href="mailto:hello@suppvis.health"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    hello@suppvis.health
                  </a>{" "}
                  <span className="text-text-muted">(general questions)</span>
                </p>
                <p>
                  <a
                    href="mailto:terms@suppvis.health"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    terms@suppvis.health
                  </a>{" "}
                  <span className="text-text-muted">
                    (terms of service questions and disputes)
                  </span>
                </p>
                <p>
                  <a
                    href="mailto:privacy@suppvis.health"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    privacy@suppvis.health
                  </a>{" "}
                  <span className="text-text-muted">
                    (privacy and data requests)
                  </span>
                </p>
              </address>
            </section>

            {/* Section 18 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                18. SMS Messaging Terms
              </h2>
              <div className="space-y-4">
                <p>
                  <strong className="text-text-primary">
                    Program Description.
                  </strong>{" "}
                  If you voluntarily provide your mobile phone number and
                  separately opt in to receive SMS messages from SuppVis, we may
                  send you recurring promotional text messages regarding beta
                  access, product and feature updates, platform announcements,
                  SuppVis news, and related information about SuppVis services.
                </p>
                <p>
                  <strong className="text-text-primary">Consent.</strong>{" "}
                  Consent to receive SMS messages is voluntary and is not
                  required as a condition of joining the SuppVis beta waitlist,
                  purchasing any product or service, creating an account, or
                  otherwise using SuppVis services.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Message Frequency.
                  </strong>{" "}
                  Message frequency varies.
                </p>
                <p>
                  <strong className="text-text-primary">Charges.</strong>{" "}
                  Message and data rates may apply depending on your mobile
                  carrier and service plan.
                </p>
                <p>
                  <strong className="text-text-primary">Opting Out.</strong>{" "}
                  You may opt out of SMS messages at any time by replying STOP.
                  After opting out, you may receive a final confirmation message
                  indicating that you have been unsubscribed.
                </p>
                <p>
                  <strong className="text-text-primary">Help.</strong> For
                  assistance, reply HELP or contact us at{" "}
                  <a
                    href="mailto:support@suppvis.health"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    support@suppvis.health
                  </a>
                  .
                </p>
                <p>
                  <strong className="text-text-primary">Privacy.</strong> We do
                  not sell, rent, share, or otherwise provide your mobile phone
                  number or SMS consent information to third parties or
                  affiliates for their own marketing or promotional purposes.
                  Please review our{" "}
                  <a
                    href="/privacy"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    Privacy Policy
                  </a>{" "}
                  for additional information about how we collect, use, and
                  protect your information.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Carrier Disclaimer.
                  </strong>{" "}
                  Mobile carriers are not responsible for delayed or undelivered
                  messages.
                </p>
              </div>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
