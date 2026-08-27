const FARGER: Record<string, string> = {
  Aktiv: "bg-sage text-white",
  Pause: "bg-brown text-white",
  Prospect: "bg-graygreen text-white",
  Avsluttet: "bg-charcoal text-white",
  Oppsagt: "bg-rose text-white",
  Idé: "bg-graygreen text-white",
  "Sendt tilbud": "bg-brown text-white",
  "I dialog": "bg-brown text-white",
  Vunnet: "bg-sage text-white",
  Tapt: "bg-charcoal text-white",
  Utsatt: "bg-charcoal text-white",
  Planlagt: "bg-graygreen text-white",
  "Pågår": "bg-sage text-white",
  "Venter på kunde": "bg-brown text-white",
  Levert: "bg-charcoal text-white",
  Stoppet: "bg-rose text-white",
  Implementert: "bg-sage text-white",
  Blokkert: "bg-rose text-white",
  "Ikke aktuelt": "bg-charcoal text-white",
  Mangler: "bg-beige text-dark",
};

export default function Pill({ value }: { value: string }) {
  return (
    <span
      className={`inline-block px-2 py-0.5 rounded-full text-[10.5px] font-medium whitespace-nowrap ${
        FARGER[value] ?? "bg-lightsage text-dark"
      }`}
    >
      {value}
    </span>
  );
}
