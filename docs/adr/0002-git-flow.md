# 0002 — Git flow como modelo de ramas

## Contexto

Equipo de 3 personas trabajando en paralelo sobre dos repos, con entregas por fases del curso.

## Decisión

Se adopta Git flow: `main` para estable/releases, `develop` como rama de integración (y por defecto para PRs), `feature/<nombre>` contra `develop` por cada issue. Sin protección de rama por ahora.

## Consecuencias

- Separa claramente "lo entregado" (`main`) de "lo que se está integrando" (`develop`).
- Más disciplina de ramas que trunk-based, adecuado para fases largas del curso.
- Al no haber protección de rama todavía, el equipo debe autodisciplinarse para no hacer push directo a `main`; se puede activar protección más adelante.
