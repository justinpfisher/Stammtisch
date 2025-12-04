import { useEffect, useState } from "react";

export default function Home() {
  const [countdown, setCountdown] = useState({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateCountdown = () => {
      // Target: Friday, January 16, 2026 at 9:00 AM EST
      const targetDate = new Date('2026-01-16T09:00:00-05:00').getTime();
      const now = new Date().getTime();
      const distance = targetDate - now;

      if (distance > 0) {
        setCountdown({
          days: Math.floor(distance / (1000 * 60 * 60 * 24)),
          hours: Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
          minutes: Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60)),
          seconds: Math.floor((distance % (1000 * 60)) / 1000),
        });
      }
    };

    const timer = setInterval(calculateCountdown, 1000);
    calculateCountdown();

    return () => clearInterval(timer);
  }, []);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground selection:bg-primary selection:text-primary-foreground">
      
      {/* Header Section - Centered & Prominent */}
      <header className="pt-16 pb-8 md:pt-24 md:pb-12">
        <div className="container flex justify-center">
          <div className="relative">
            {/* Main Logo Container */}
            <div className="w-72 h-72 md:w-96 md:h-96 relative z-10">
              <img 
                src="/images/stammtisch_logo_final.png" 
                alt="Stammtisch Social Club Crest" 
                className="w-full h-full object-contain drop-shadow-2xl"
              />
            </div>
            
            {/* Subtle decorative glow behind logo */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3/4 h-3/4 bg-[#c5a059]/10 blur-3xl -z-10 rounded-full"></div>
          </div>
        </div>
      </header>

      <main className="flex-grow">
        <div className="container max-w-4xl">
          
          <div className="divider-ornamental">
            <span className="text-[#c5a059] text-2xl">❖</span>
          </div>

          {/* Main Content */}
          <section className="prose prose-lg md:prose-xl prose-stone mx-auto text-center">
            <h2 className="font-display text-3xl md:text-4xl text-[#1a3c28] mb-8 text-center">
              A Tradition of Gathering
            </h2>
            
            <div className="font-body text-lg md:text-xl leading-relaxed space-y-6 text-[#3e2b22]">
              <p>
                The <span className="font-bold text-[#1a3c28]">Stammtisch Social Club</span> is an association dedicated to elevating the longstanding tradition of gathering with intention, consistency, and an admirable degree of ceremony. Composed of a select membership, the Stammtisch Social Club maintains a reputation for structure and significance disproportionate to the simplicity of its activities.
              </p>
              <p>
                The Stammtisch Social Club distinguishes itself through a rare blend of informality and ceremony. While the aim of the Club is uncomplicated, the commitment to process, structure, and tradition is maintained with a seriousness that has become one of its defining qualities.
              </p>
              <p className="italic text-[#6b5c54] border-l-4 border-[#c5a059] pl-6 py-2 my-8 text-left mx-auto max-w-2xl">
                This balance — understated, deliberate, and fully committed to the art of showing up — forms the essence of the Stammtisch Social Club.
              </p>
            </div>
          </section>

          <div className="divider-ornamental">
            <span className="text-[#c5a059] text-2xl">❖</span>
          </div>

          {/* Traditional Countdown Timer Section */}
          <section className="py-12 mb-20">
            <div className="traditional-countdown">
              <div className="absolute top-0 left-0 w-full h-full border border-[#c5a059] m-2 pointer-events-none opacity-50"></div>
              
              <h2 className="traditional-countdown-title">
                The Stammtisch Gentlemen's Assembly
              </h2>
              
              <div className="countdown-grid">
                {/* Days */}
                <div className="countdown-unit">
                  <div className="countdown-value">
                    {String(countdown.days).padStart(2, '0')}
                  </div>
                  <div className="countdown-label">Days</div>
                </div>

                <div className="countdown-separator">:</div>

                {/* Hours */}
                <div className="countdown-unit">
                  <div className="countdown-value">
                    {String(countdown.hours).padStart(2, '0')}
                  </div>
                  <div className="countdown-label">Hours</div>
                </div>

                <div className="countdown-separator">:</div>

                {/* Minutes */}
                <div className="countdown-unit">
                  <div className="countdown-value">
                    {String(countdown.minutes).padStart(2, '0')}
                  </div>
                  <div className="countdown-label">Minutes</div>
                </div>

                <div className="countdown-separator">:</div>

                {/* Seconds */}
                <div className="countdown-unit">
                  <div className="countdown-value">
                    {String(countdown.seconds).padStart(2, '0')}
                  </div>
                  <div className="countdown-label">Seconds</div>
                </div>
              </div>

              <div className="mt-8 font-accent text-[#c5a059] text-lg tracking-wide uppercase opacity-80">
                Friday, January 16, 2026 at 9:00 AM EST
              </div>
            </div>
          </section>

        </div>
      </main>

      {/* Footer */}
      <footer className="py-8 border-t border-[#d6cfc2] mt-auto">
        <div className="container text-center">
          <p className="font-accent text-[#6b5c54] text-sm tracking-widest uppercase">
            &copy; {new Date().getFullYear()} Stammtisch Social Club
          </p>
        </div>
      </footer>
    </div>
  );
}
