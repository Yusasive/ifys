const FAQS = [
  {
    question: "Who can attend the Summit?",
    answer:
      "The summit is open to students, young professionals, founders, and anyone curious about the future of Islamic finance, innovation, and ethical leadership.",
  },
  {
    question: "Is the summit open to international participants?",
    answer:
      "Yes. While the summit is hosted in Ilorin, Nigeria, participants from outside Nigeria are welcome to register and attend in person.",
  },
  {
    question: "Is the summit a paid event?",
    answer:
      "Yes, tickets are required to attend. Student and professional tiers are available, with an early-bird discount for those who register ahead of time.",
  },
  {
    question: "What can participants expect from the summit?",
    answer:
      "A full day of keynote sessions, panel discussions, an innovation showcase, and career conversations with builders and leaders across Islamic finance and ethical innovation.",
  },
  {
    question: "Will there be networking opportunities during the summit?",
    answer:
      "Yes. Networking breaks, a lunch session, and a closing mixer are built into the program so participants can connect with speakers and fellow attendees.",
  },
  {
    question: "How can I register for the summit?",
    answer:
      "Use the Get Tickets button anywhere on this page to choose your ticket and complete registration online.",
  },
  {
    question: "Why should I attend the Islamic Finance Youth Summit?",
    answer:
      "It's a rare gathering of the people actively building the next generation of ethical finance, a chance to learn, connect, and shape ideas that outlast the day itself.",
  },
];

export function FaqSection() {
  return (
    <section id="faq" className="bg-islamic-pattern">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 sm:py-24">
        <p className="font-plex font-normal text-sm sm:text-base tracking-[0.15em] text-rust uppercase mb-4 text-center">
          Frequently Asked Questions
        </p>
        <h2 className="font-bricolage font-medium text-2xl sm:text-[40px] leading-[1.2] sm:leading-[60px] tracking-normal text-black text-center mb-12 sm:mb-14">
          Good to Know
        </h2>

        <div className="flex flex-col gap-4">
          {FAQS.map((faq) => (
            <details
              key={faq.question}
              className="group bg-white border border-line/50 rounded-2xl px-5 sm:px-8 py-5 sm:py-6 shadow-[0_1px_2px_rgba(16,32,29,0.06)] open:shadow-md transition-shadow"
            >
              <summary className="flex items-center justify-between gap-4 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-bricolage font-bold text-base sm:text-xl text-forest">
                {faq.question}
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  className="w-5 h-5 sm:w-6 sm:h-6 shrink-0 text-forest transition-transform duration-200 group-open:rotate-180"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 9l6 6 6-6" />
                </svg>
              </summary>
              <p className="text-sm sm:text-base text-forest/70 leading-relaxed mt-4">{faq.answer}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
