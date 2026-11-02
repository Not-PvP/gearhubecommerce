import { useEffect, useState } from "react";
import slidesData from "../../utils/mockHero.json";
import { useCard } from "../../state/CardContext";
import "./Hero.css";

interface Slide {
  id: string;
  image: string;
  headline: string;
  subtext: string;
  category: string;
}

const slides: Slide[] = slidesData;

const AUTOPLAY_MS = 6000;

const shopLabel = (category: string) => {
  const lower = category.toLowerCase();
  return lower.endsWith("s") ? lower : `${lower}s`;
};

const Hero: React.FC = () => {
  const { dispatch } = useCard();
  const [current, setCurrent] = useState(0);
  const [paused, setPaused] = useState(false);

  const goPrev = () => {
    setCurrent((prev) => (prev === 0 ? slides.length - 1 : prev - 1));
  };

  const goNext = () => {
    setCurrent((prev) => (prev === slides.length - 1 ? 0 : prev + 1));
  };

  useEffect(() => {
    if (paused) return;
    if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const timer = setTimeout(goNext, AUTOPLAY_MS);
    return () => clearTimeout(timer);
  }, [current, paused]);

  const onShop = (category: string) => {
    dispatch({ type: "SET_CATEGORY", payload: category });
    document.getElementById("shop")?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <section
      className="hero"
      aria-roledescription="carousel"
      aria-label="Featured gear"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocus={() => setPaused(true)}
      onBlur={() => setPaused(false)}
    >
      <div className="hero-track" style={{ transform: `translateX(-${current * 100}%)` }}>
        {slides.map((slide, index) => (
          <div
            key={slide.id}
            className="hero-slide"
            style={{ backgroundImage: `url(${slide.image})` }}
            role="group"
            aria-roledescription="slide"
            aria-label={`${index + 1} of ${slides.length}: ${slide.headline}. ${slide.subtext}`}
            aria-hidden={index !== current}
          >
            <button
              className="hero-cta"
              onClick={() => onShop(slide.category)}
              tabIndex={index === current ? 0 : -1}
            >
              Shop {shopLabel(slide.category)}
            </button>
          </div>
        ))}
      </div>

      <button className="hero-arrow hero-arrow-left" onClick={goPrev} aria-label="Previous slide">
        <img src="/images/arrow-left.svg" alt="" aria-hidden="true" />
      </button>
      <button className="hero-arrow hero-arrow-right" onClick={goNext} aria-label="Next slide">
        <img src="/images/arrow-right.svg" alt="" aria-hidden="true" />
      </button>

      <div className="hero-dots">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            className={`hero-dot ${index === current ? "hero-dot-active" : ""} ${index === current && !paused ? "is-playing" : ""}`}
            onClick={() => setCurrent(index)}
            aria-label={`Go to slide ${index + 1}: ${slide.headline}`}
            aria-current={index === current ? "true" : undefined}
          >
            {index === current && !paused && (
              <span className="hero-dot-fill" style={{ animationDuration: `${AUTOPLAY_MS}ms` }} />
            )}
          </button>
        ))}
      </div>
    </section>
  );
};

export default Hero;
