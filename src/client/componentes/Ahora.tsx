// La tarjeta «Ahora»: lo que le toca a cada rol propio en grande y, debajo, lo que vale para todos.
export function Ahora({ textos }: { textos: string[] }) {
  const propios = textos.length > 1 ? textos.slice(0, -1) : textos;
  const general = textos.length > 1 ? textos[textos.length - 1] : null;
  return (
    <section className="ahora" aria-live="polite">
      <p className="k">Ahora</p>
      {propios.map((t) => <p key={t} className="t">{t}</p>)}
      {general && <p className="s">{general}</p>}
    </section>
  );
}
