# Kurosei

App personal de entrenamiento, nutrición, finanzas y supermercado. React + TypeScript
+ Vite, con Dexie (IndexedDB) como base local y Supabase para sincronizar.

## Flujo de trabajo: no preguntar, hacer

Cuando Pablo pide un cambio, el ciclo completo va solo, **sin preguntar en ningún
paso**: desarrollar, validar, subir, abrir el PR y fusionarlo a `main`.

No hay que pedir permiso para crear el PR ni para fusionarlo. "Haz el cambio"
significa "déjalo publicado en `kurosei-smoky.vercel.app`".

1. Rama nueva desde `main` (prefijo `claude/`). Si el PR anterior de esa rama ya se
   fusionó, partir de `main` otra vez en vez de apilar commits sobre lo fusionado.
2. Validar **antes** de subir, siempre las tres:
   ```
   npm run build   # tsc -b && vite build
   npm run lint    # oxlint
   npm test        # vitest run
   ```
3. Para cambios de interfaz, comprobarlos además en el navegador a ancho de teléfono
   (~393 px) antes de darlos por buenos. Chromium y Playwright ya están instalados;
   hay que lanzarlos con `executablePath: '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'`.
4. Push, PR, y fusionar con **squash**, con el número del PR al final del título:
   `Ordena los presupuestos del mes de mayor a menor monto (#68)`.

### Cuándo sí detenerse

- **Algo falla** (build, lint, tests o CI rojo): no fusionar. Arreglarlo; y si no se
  puede, decir qué está fallando en vez de publicar algo roto.
- **La petición se puede entender de dos formas** y cada una lleva a un trabajo
  distinto: preguntar antes de gastar el rato en la equivocada.
- **Borrar datos o cosas difíciles de deshacer** que no estaban en lo que se pidió.

Que algo sea "grande" no es motivo para detenerse. Que sea ambiguo, sí.

## Idioma

Todo en español, en el mismo tono que ya tiene el repo: mensajes de commit,
títulos y descripciones de PR, y los comentarios del código.

Los comentarios explican **por qué** se hizo algo, no qué hace la línea. Así están
escritos los que ya existen, y conviene seguirlos:

```ts
// Sin presupuesto va después de un presupuesto de 0: poner 0 es decir algo,
// no ponerlo es no haberlo decidido todavía.
```

## Estructura

```
src/modules/<módulo>/     training · nutrition · finance · grocery · sync
  components/             pantallas y piezas de interfaz
  db/                     acceso a Dexie (repositorios)
  domain/types.ts         tipos del dominio
  lib/                    lógica pura, sin React ni Dexie
src/shared/db/database.ts el esquema de Dexie, acumulativo
src/App.css               casi todos los estilos
```

## Cosas que conviene saber antes de tocar

- **El esquema de Dexie es acumulativo.** Nunca quitar un `version()` pasado: un
  navegador que ya tenga datos falla al cargar con `VersionError`.
- **La lógica va en `lib/`, no en el componente.** Es lo único que está cubierto por
  tests, y así se puede probar sin montar React. Cuando una pantalla necesite
  ordenar, calcular o agrupar, ese criterio va en `lib/` con su test.
- **Antes de escribir un criterio nuevo, buscar si ya existe.** Varias vistas
  comparten reglas (por ejemplo `sortCategoriesForGrid` ordena los presupuestos en
  Categorías y en Transacciones). Duplicarlo hace que las dos vistas se separen con
  el tiempo.
- **Los tests son de lógica pura** (`*.test.ts`, vitest). No hay tests de componentes
  ni la librería para escribirlos; no introducir ese patrón sin acordarlo antes.
- **Todo tiene que caber en una pantalla de teléfono.** Es el único lugar donde se
  usa la app. Nada de desbordes horizontales.

## Vercel

`kurosei-smoky.vercel.app` es producción y se despliega desde `main`. Cada PR además
genera una URL de preview temporal, distinta y con nombre largo: sirve para revisar
antes de fusionar, pero no reemplaza a la de producción y desaparece al cerrar el PR.
