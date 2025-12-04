import { useEffect, useState } from 'react';

/**
 * Stammtisch Social Club Homepage
 * 
 * Design Philosophy: Neo-Baroque Heritage
 * - Deep forest green and charcoal anchors with burnished gold accents
 * - Asymmetric layout with generous whitespace
 * - Ornamental restraint: decorative elements frame key sections
 * - Red countdown timer as intentional disruption against somber aesthetic
 * - Typography: Playfair Display (headings), Crimson Text (body), Cormorant Garamond (accents)
 */

interface CountdownState {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export default function Home() {
  const [countdown, setCountdown] = useState<CountdownState>({
    days: 0,
    hours: 0,
    minutes: 0,
    seconds: 0,
  });

  useEffect(() => {
    const calculateCountdown = () => {
      // Target: Friday, January 16, 2025 at 9:00 AM EST
      const targetDate = new Date('2025-01-16T09:00:00-05:00').getTime();
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

    calculateCountdown();
    const interval = setInterval(calculateCountdown, 1000);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen wood-texture">
      {/* Header */}
      <header className="border-b border-accent/20 py-12">
        <div className="container">
          <div className="flex items-start justify-between gap-8 mb-8">
            {/* Logo Section - Asymmetric Left Placement */}
            <div className="flex-shrink-0 w-48">
              <div className="heraldic-frame">
                <img
                  src="/images/stammtisch_logo.png"
                  alt="Stammtisch Social Club"
                  className="w-full h-auto"
                />
              </div>
            </div>

            {/* Title Section - Right Side */}
            <div className="flex-1 pt-4">
              <div className="text-accent mb-3 text-sm tracking-widest">
                Est. 2024
              </div>
              <h1 className="text-4xl md:text-5xl text-primary mb-4">
                Stammtisch
              </h1>
              <p className="text-lg text-muted-foreground max-w-md">
                Social Club
              </p>
            </div>
          </div>

          <div className="divider-ornamental" />
        </div>
      </header>

      {/* Main Content */}
      <main className="container py-16">
        {/* About Section */}
        <section className="mb-20 stagger-item">
          <div className="max-w-3xl">
            <h2 className="text-3xl mb-8 text-primary">
              A Tradition of Gathering
            </h2>
            <div className="space-y-6 text-foreground leading-relaxed">
              <p>
                The Stammtisch Social Club is an association dedicated to elevating the longstanding tradition of gathering with intention, consistency, and an admirable degree of ceremony. Composed of a select membership, the Stammtisch Social Club maintains a reputation for structure and significance disproportionate to the simplicity of its activities.
              </p>
              <p>
                The Stammtisch Social Club distinguishes itself through a rare blend of informality and ceremony. While the aim of the Club is uncomplicated, the commitment to process, structure, and tradition is maintained with a seriousness that has become one of its defining qualities.
              </p>
              <p className="italic text-muted-foreground">
                This balance — understated, deliberate, and fully committed to the art of showing up — forms the essence of the Stammtisch Social Club.
              </p>
            </div>
          </div>
        </section>

        <div className="divider-ornamental" />

        {/* Countdown Timer Section */}
        <section className="py-20 my-12 bg-gradient-to-br from-red-50 to-red-100/50 border-4 border-destructive rounded-sm shadow-lg">
          <div className="container text-center">
            <div className="text-accent text-sm tracking-widest mb-4 uppercase">
              The Cottage Weekend Awaits
            </div>
            <h2 className="text-2xl md:text-3xl text-destructive mb-12 font-bold">
              Stammtisch Cottage Weekend
            </h2>

            {/* Countdown Display */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8 mb-8">
              {/* Days */}
              <div className="stagger-item">
                <div className="countdown-timer">
                  {String(countdown.days).padStart(2, '0')}
                </div>
                <div className="text-sm uppercase tracking-widest text-destructive/70 mt-2">
                  Days
                </div>
              </div>

              {/* Hours */}
              <div className="stagger-item">
                <div className="countdown-timer">
                  {String(countdown.hours).padStart(2, '0')}
                </div>
                <div className="text-sm uppercase tracking-widest text-destructive/70 mt-2">
                  Hours
                </div>
              </div>

              {/* Minutes */}
              <div className="stagger-item">
                <div className="countdown-timer">
                  {String(countdown.minutes).padStart(2, '0')}
                </div>
                <div className="text-sm uppercase tracking-widest text-destructive/70 mt-2">
                  Minutes
                </div>
              </div>

              {/* Seconds */}
              <div className="stagger-item">
                <div className="countdown-timer">
                  {String(countdown.seconds).padStart(2, '0')}
                </div>
                <div className="text-sm uppercase tracking-widest text-destructive/70 mt-2">
                  Seconds
                </div>
              </div>
            </div>

            <div className="text-destructive/60 text-sm">
              Friday, January 16, 2025 at 9:00 AM EST
            </div>
          </div>
        </section>

        <div className="divider-ornamental" />

        {/* Closing Statement */}
        <section className="py-12 text-center stagger-item">
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto italic">
            "The Stammtisch: where tradition meets intention, and ceremony becomes the substance of friendship."
          </p>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-accent/20 py-8 mt-20">
        <div className="container">
          <div className="text-center text-sm text-muted-foreground">
            <p>Stammtisch Social Club</p>
            <p className="text-xs mt-2">A gathering place for men of intention</p>
          </div>
        </div>
      </footer>
    </div>
  );
}
