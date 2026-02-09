import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Code2, Target, BookOpen, Calendar, ChevronRight, Zap, BarChart3, Users } from "lucide-react";
import heroBg from "@/assets/hero-bg.jpg";

const features = [
  {
    icon: Target,
    title: "Placement Quiz",
    description: "Assess your current HTML, CSS, and JavaScript skills with our adaptive quiz system.",
  },
  {
    icon: BarChart3,
    title: "Performance Analysis",
    description: "Get detailed insights into your strengths and weaknesses across every topic.",
  },
  {
    icon: BookOpen,
    title: "Smart Recommendations",
    description: "Receive curated videos, docs, and tutorials matched to your weak areas.",
  },
  {
    icon: Calendar,
    title: "Personalized Study Plan",
    description: "Generate a custom schedule based on your free time and focus areas.",
  },
];

export default function Index() {
  return (
    <div className="min-h-screen">
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-card">
        <div className="container flex items-center justify-between h-16">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg accent-gradient flex items-center justify-center">
              <Code2 className="h-5 w-5 text-accent-foreground" />
            </div>
            <span className="font-display font-bold text-lg">CodePath</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild>
              <Link to="/auth">Sign In</Link>
            </Button>
            <Button variant="hero" asChild>
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative min-h-[90vh] flex items-center overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{ backgroundImage: `url(${heroBg})` }}
        />
        <div className="absolute inset-0 hero-gradient opacity-80" />
        <div className="container relative z-10 py-32">
          <div className="max-w-2xl animate-fade-in">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary/20 text-secondary text-sm font-medium mb-6">
              <Zap className="h-4 w-4" />
              Personalized Learning Platform
            </div>
            <h1 className="text-4xl md:text-6xl font-display font-bold text-primary-foreground leading-tight mb-6 text-balance">
              Master Web Development at Your Own Pace
            </h1>
            <p className="text-lg md:text-xl text-primary-foreground/80 mb-8 max-w-xl">
              Take a placement quiz, discover your weak spots, and follow a study plan built just for you. HTML, CSS, and JavaScript — all in one place.
            </p>
            <Button variant="hero" size="lg" asChild>
              <Link to="/auth">
                Start Learning Free
                <ChevronRight className="h-5 w-5" />
              </Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 bg-background">
        <div className="container">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
              How CodePath Works
            </h2>
            <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
              Four simple steps to transform your web development skills
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="group card-gradient rounded-xl p-6 shadow-card hover:shadow-elevated transition-all duration-300 hover:-translate-y-1"
                style={{ animationDelay: `${i * 100}ms` }}
              >
                <div className="h-12 w-12 rounded-lg accent-gradient flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <feature.icon className="h-6 w-6 text-accent-foreground" />
                </div>
                <h3 className="font-display font-semibold text-lg mb-2">{feature.title}</h3>
                <p className="text-muted-foreground text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Stats */}
      <section className="py-16 hero-gradient">
        <div className="container">
          <div className="grid md:grid-cols-3 gap-8 text-center">
            {[
              { value: "12", label: "Topics Covered" },
              { value: "3", label: "Languages: HTML, CSS, JS" },
              { value: "∞", label: "Practice Questions" },
            ].map((stat) => (
              <div key={stat.label}>
                <div className="text-4xl font-display font-bold text-secondary mb-2">
                  {stat.value}
                </div>
                <div className="text-primary-foreground/70">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-24 bg-background">
        <div className="container text-center">
          <h2 className="text-3xl md:text-4xl font-display font-bold mb-4">
            Ready to Level Up?
          </h2>
          <p className="text-muted-foreground text-lg mb-8 max-w-lg mx-auto">
            Join CodePath today and get a personalized study plan tailored to your learning needs.
          </p>
          <Button variant="hero" size="lg" asChild>
            <Link to="/auth">
              Get Started Now
              <ChevronRight className="h-5 w-5" />
            </Link>
          </Button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 border-t border-border">
        <div className="container flex items-center justify-between text-sm text-muted-foreground">
          <div className="flex items-center gap-2">
            <Code2 className="h-4 w-4" />
            <span className="font-display">CodePath</span>
          </div>
          <span>© 2026 CodePath. All rights reserved.</span>
        </div>
      </footer>
    </div>
  );
}
