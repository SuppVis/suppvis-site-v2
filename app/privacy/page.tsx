import type { Metadata } from "next";
import Nav from "../components/Nav";
import Footer from "../components/Footer";

export const metadata: Metadata = {
  title: "Privacy Policy - SuppVis",
  description:
    "How SuppVis collects, uses, shares, and protects your information.",
};

export default function PrivacyPage() {
  return (
    <>
      <Nav />
      <main className="pt-32 md:pt-40 pb-24 px-6">
        <article className="max-w-[760px] mx-auto">
          <h1 className="font-headline font-extrabold text-3xl sm:text-4xl md:text-5xl text-text-primary mb-4 leading-tight">
            Privacy Policy
          </h1>
          <p className="text-text-muted text-sm mb-12">
            Effective date: July 9th, 2026
          </p>

          <div className="space-y-10 text-[15px] text-text-secondary leading-[1.75]">
            <p>
              This Privacy Policy describes how SuppVis (&ldquo;SuppVis,&rdquo;
              &ldquo;we,&rdquo; &ldquo;us&rdquo;) collects, uses, shares, and
              protects your information when you use our iOS application,
              website, and related services (collectively, the
              &ldquo;Services&rdquo;). SuppVis is operated by SuppVis LLC, based
              in California, United States.
            </p>
            <p>
              By creating an account or using SuppVis, you agree to the
              practices described in this policy. If you do not agree, please do
              not use the Services.
            </p>

            {/* Section 1 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                1. Information We Collect
              </h2>
              <div className="space-y-4">
                <p>
                  <strong className="text-text-primary">
                    Account information.
                  </strong>{" "}
                  Name, email address, password (stored as a one-way hash), and
                  account creation date.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Health profile data.
                  </strong>{" "}
                  Date of birth, biological sex, height, weight, pregnancy
                  status (where applicable), health conditions you log,
                  medications you log, and health goals you select.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Supplement data.
                  </strong>{" "}
                  Supplements in your current stack, dosages, frequencies,
                  brands, and the source of each entry (whether you added it
                  manually or it came from a SuppVis recommendation).
                </p>
                <p>
                  <strong className="text-text-primary">
                    Daily check-in and habit data.
                  </strong>{" "}
                  Symptom ratings, energy levels, sleep quality, mood, and other
                  self-reported health tracking data you submit over time, along
                  with timestamps.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Engagement data.
                  </strong>{" "}
                  Which recommendations you accept, decline, or modify. Which
                  features you use and how often. We use this to improve
                  recommendation quality.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Device and usage data.
                  </strong>{" "}
                  App version, iOS version, device model, IP address,
                  approximate location derived from IP (city or region level
                  only), session duration, and crash logs. We do not collect
                  precise GPS location.
                </p>
                <p>
                  <strong className="text-text-primary">Communications.</strong>{" "}
                  Messages you send to our support team and your responses to
                  surveys or feedback prompts.
                </p>
                <p>
                  We do not collect financial or payment information directly.
                  Purchases made through Amazon affiliate links or partner brand
                  links are processed entirely by those third parties under their
                  own privacy policies.
                </p>
              </div>
            </section>

            {/* Section 2 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                2. How We Use Your Information
              </h2>
              <p className="mb-4">We use the information you provide to:</p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  Generate personalized supplement recommendations based on your
                  health profile, goals, conditions, medications, and check-in
                  history.
                </li>
                <li>
                  Screen recommendations against the medications and conditions
                  you&rsquo;ve logged for potential interactions.
                </li>
                <li>
                  Calculate and display goal progress scores, supplement
                  effectiveness signals, and health insights specific to you.
                </li>
                <li>
                  Improve the accuracy of our recommendation engine, scoring
                  models, and safety screening.
                </li>
                <li>
                  Communicate with you about platform updates, new features, and
                  relevant health content. You may opt out of marketing
                  communications at any time.
                </li>
                <li>
                  Investigate and prevent fraud, abuse, security incidents, and
                  violations of our Terms of Service.
                </li>
                <li>Comply with legal obligations.</li>
              </ul>
              <div className="mt-6 rounded-2xl border border-accent/25 bg-accent/5 p-5 shadow-[0_0_30px_rgba(20,184,166,0.08)]">
                <p>
                  <strong className="text-text-primary">
                    SMS/Text Messaging.
                  </strong>{" "}
                  If you provide your mobile number and opt in, SuppVis may send
                  you text messages about beta access, product updates, and
                  SuppVis news. Message frequency varies. Message and data rates
                  may apply. You can opt out at any time by replying STOP, or
                  reply HELP for help. We do not sell, rent, or share your mobile
                  phone number or your SMS consent/opt-in information with any
                  third parties or affiliates for their own marketing purposes.
                  Mobile opt-in data is excluded from the anonymized
                  data-sharing and any other sharing arrangements described in
                  this policy.
                </p>
              </div>
              <p className="mt-4">
                We do not use your individual health data to serve advertising
                and we do not build advertising profiles from your personal
                information.
              </p>
            </section>

            {/* Section 3 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                3. How AI and Machine Learning Use Your Data
              </h2>
              <p className="mb-4">
                SuppVis uses artificial intelligence to personalize
                recommendations. To do this, portions of your health profile,
                supplement data, and check-in data are processed by:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li>
                  <strong className="text-text-primary">
                    Our internal recommendation engine and scoring models,
                  </strong>{" "}
                  which run within our infrastructure on AWS.
                </li>
                <li>
                  <strong className="text-text-primary">
                    Third-party AI providers including Anthropic and OpenAI,
                  </strong>{" "}
                  which we use to generate written explanations and conduct
                  research synthesis around recommendations our system has
                  already produced. These providers do not use SuppVis API inputs
                  to train their models under our agreements with them.
                </li>
              </ul>
              <p className="mt-4">
                <strong className="text-text-primary">Important:</strong> Our AI
                providers generate explanatory language around facts our own
                system retrieves. We do not rely on third-party AI to remember
                medical facts about you or to make safety decisions on your
                behalf.
              </p>
            </section>

            {/* Section 4 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                4. How We Share Your Information
              </h2>
              <p className="mb-4">
                We share information only as described below.
              </p>
              <div className="space-y-4">
                <div>
                  <strong className="text-text-primary">
                    Service providers.
                  </strong>{" "}
                  We share data with vendors that help us operate the Services,
                  including:
                  <ul className="list-disc pl-6 mt-2 space-y-1">
                    <li>
                      Amazon Web Services (AWS) for cloud infrastructure and
                      encrypted data storage
                    </li>
                    <li>
                      Anthropic and OpenAI for AI processing as described in
                      Section 3
                    </li>
                    <li>
                      Email and analytics providers that help us communicate with
                      users and understand product usage
                    </li>
                    <li>
                      Payment processors, if and when we introduce paid tiers
                    </li>
                  </ul>
                  <p className="mt-2">
                    These providers are contractually bound to use your data only
                    to perform services for SuppVis.
                  </p>
                </div>
                <p>
                  <strong className="text-text-primary">
                    Anonymized and aggregated data.
                  </strong>{" "}
                  We may create anonymized and aggregated datasets that cannot
                  reasonably be linked back to you as an individual, and we may
                  share or sell these datasets to third parties including
                  researchers, supplement manufacturers, and health industry
                  partners. Examples include population-level patterns about
                  supplement effectiveness, condition prevalence, and stack
                  composition. We will not share or sell data that identifies you
                  personally as part of these arrangements.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Affiliate partners.
                  </strong>{" "}
                  When you click a product link in SuppVis and complete a
                  purchase, the merchant (such as Amazon or a partner brand) may
                  receive information about that transaction under their own
                  privacy policy. We do not share your SuppVis health profile
                  with affiliate partners.
                </p>
                <p>
                  <strong className="text-text-primary">
                    Legal and safety reasons.
                  </strong>{" "}
                  We may disclose information if required by law, in response to
                  valid legal requests, to protect the rights or safety of
                  SuppVis, our users, or others, or in connection with a
                  corporate transaction such as a merger or acquisition (in which
                  case affected users will be notified).
                </p>
                <p>
                  We do not sell or rent personal information that identifies you
                  individually.
                </p>
              </div>
            </section>

            {/* Section 5 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                5. Your Rights and Choices
              </h2>
              <p className="mb-4">
                Regardless of where you live, you can:
              </p>
              <ul className="list-disc pl-6 space-y-2 mb-4">
                <li>Access the data we hold about you</li>
                <li>Correct inaccurate or incomplete data</li>
                <li>Delete your account and associated personal data</li>
                <li>Export your data in a machine-readable format</li>
                <li>
                  Opt out of marketing emails using the unsubscribe link in any
                  message we send
                </li>
              </ul>
              <p className="mb-4">
                If you live in California, Virginia, Colorado, Connecticut, Utah,
                or other states with applicable privacy laws, you may have
                additional rights including the right to opt out of the sale or
                sharing of personal information for cross-context behavioral
                advertising. SuppVis does not engage in cross-context behavioral
                advertising. To opt out of inclusion in our anonymized data
                sharing program, contact us at the address below.
              </p>
              <p className="mb-4">
                If you live in the European Economic Area, the United Kingdom, or
                another jurisdiction with comprehensive privacy laws, you have
                rights under those laws including rights to object to processing
                and to lodge complaints with your local data protection
                authority.
              </p>
              <p>
                To exercise any of these rights, contact us at{" "}
                <a
                  href="mailto:privacy@suppvis.health"
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  privacy@suppvis.health
                </a>
                . We will verify your identity and respond within 30 days, or as
                required by applicable law.
              </p>
            </section>

            {/* Section 6 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                6. Data Retention
              </h2>
              <p className="mb-4">
                We retain your account and health data for as long as your
                account is active. If you delete your account, we will
                permanently delete your personal data within 30 days, except
                where retention is required by law (for example, fraud prevention
                or tax records).
              </p>
              <p>
                Anonymized and aggregated data that cannot reasonably be linked
                back to you may be retained indefinitely.
              </p>
            </section>

            {/* Section 7 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                7. Data Security
              </h2>
              <p className="mb-4">
                We use industry-standard security measures to protect your
                information, including encryption in transit (TLS), encryption at
                rest, role-based access controls, and regular security reviews.
                Access to identifiable health data is limited to personnel who
                require it to operate the Services.
              </p>
              <p>
                No system is completely secure. If we discover a data breach
                affecting your personal information, we will notify you as
                required by applicable law.
              </p>
            </section>

            {/* Section 8 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                8. International Data Transfers
              </h2>
              <p>
                SuppVis stores and processes data in the United States. If you
                access the Services from outside the United States, your data
                will be transferred to and processed in the United States, which
                may have different privacy protections than your home
                jurisdiction. By using SuppVis, you consent to this transfer.
              </p>
            </section>

            {/* Section 9 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                9. Children&rsquo;s Privacy
              </h2>
              <p>
                SuppVis is intended for adults age 18 and older. We do not
                knowingly collect personal information from anyone under 18. If
                you believe we have collected data from someone under 18, please
                contact us at{" "}
                <a
                  href="mailto:privacy@suppvis.health"
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  privacy@suppvis.health
                </a>{" "}
                and we will promptly delete it.
              </p>
            </section>

            {/* Section 10 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                10. Medical Disclaimer
              </h2>
              <p>
                SuppVis provides personalized supplement information for general
                wellness purposes. We are not a medical service. Our
                recommendations are not medical advice, diagnosis, or treatment,
                and our interaction screening can only check against the
                medications and conditions you&rsquo;ve shared with us. Always
                consult a qualified healthcare provider before starting,
                stopping, or changing any supplement, especially if you have a
                medical condition, take prescription medications, or are pregnant
                or nursing. See our{" "}
                <a
                  href="/terms"
                  className="text-accent hover:text-accent-hover transition-colors"
                >
                  Terms of Service
                </a>{" "}
                for the full disclaimer.
              </p>
            </section>

            {/* Section 11 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                11. Changes to This Policy
              </h2>
              <p>
                We may update this Privacy Policy as our Services and applicable
                laws evolve. When we make material changes, we will notify
                registered users by email or through an in-app notice at least 30
                days before changes take effect. The effective date at the top of
                this page reflects the most recent revision. Continued use after
                changes take effect constitutes acceptance.
              </p>
            </section>

            {/* Section 12 */}
            <section>
              <h2 className="font-headline font-bold text-xl text-text-primary mb-4">
                12. Contact Us
              </h2>
              <p className="mb-4">
                Questions, concerns, or requests can be sent to:
              </p>
              <address className="not-italic space-y-1 text-text-primary">
                <p>SuppVis LLC</p>
                <p>7486 La Jolla Blvd Suite 1044</p>
                <p>La Jolla, CA 92037</p>
                <p>
                  <a
                    href="mailto:privacy@suppvis.health"
                    className="text-accent hover:text-accent-hover transition-colors"
                  >
                    privacy@suppvis.health
                  </a>
                </p>
              </address>
            </section>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
