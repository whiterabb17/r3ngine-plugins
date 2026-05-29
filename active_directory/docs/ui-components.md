# Active Directory Plugin — UI Components

## Technology Stack

- **React** (functional components, TypeScript)
- **Vite** (build tool)
- **MUI** (Material UI)
- Plugin bundle at `/p/active-directory`

---

## Main Component: `ADDashboardPage`

### Layout

```
┌───────────────────────────────────────────────────────────┐
│  Assessment Progress Banner (when running)                 │
├───────────────────────────────────────────────────────────┤
│  KPI Cards: DCs | Trusts | Exposures | Risk Score         │
├──────────────────────────┬────────────────────────────────┤
│  Assessment List         │  Detail Panel                  │
│  - Domain name           │  - Domain controllers tab      │
│  - Status badge          │  - Trust relationships tab     │
│  - Start/Cancel buttons  │  - Exposures tab               │
│                          │  - Graph visualization tab     │
└──────────────────────────┴────────────────────────────────┘
```

---

## Real-Time Progress

The UI subscribes to WebSocket events during an active assessment:

- **`phase_started`** → Updates the progress banner.
- **`identity_discovered`** → Increments DC count in the KPI card in real-time.
- **`trust_discovered`** → Increments trust count.
- **`finding_detected`** → Shows a toast alert for high-severity findings.
- **`assessment_finished`** → Hides progress banner, refreshes data.

---

## Graph Visualization

The **Graph** tab uses a network visualization library to render AD domain/trust relationships as an interactive graph:

- **Nodes**: Domains (colored by role: forest root, child domain).
- **Edges**: Trust relationships (colored by risk: red for high-risk bidirectional/transitive).
- **Click a node**: Highlights connected trusts and shows the domain detail panel.

---

## Build

```bash
cd r3ngine-plugins/active_directory/ui
npm install
npm run build
```
