import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDown,
  ArrowRight,
  BookOpen,
  CalendarRange,
  Check,
  Clapperboard,
  Cloud,
  Database,
  FileBox,
  Grid3x3,
  HardDrive,
  KeyRound,
  LayoutTemplate,
  MessageSquare,
  Monitor,
  PenLine,
  PlaySquare,
  RotateCcw,
  Server,
  Upload,
  Users,
} from 'lucide-react';

const SECTIONS = [
  { id: 'overview', title: 'How Zeno fits together' },
  { id: 'quick-start', title: 'Quick start' },
  { id: 'workflow', title: 'The production workflow' },
  { id: 'roles', title: 'Roles and permissions' },
  { id: 'new-project', title: 'Set up a project' },
  { id: 'templates', title: 'Task templates' },
  { id: 'breakdown', title: 'Breakdown (casting)' },
  { id: 'schedule', title: 'Schedule' },
  { id: 'team', title: 'Team and invites' },
  { id: 'connect-dcc', title: 'Connect Blender' },
  { id: 'publishing', title: 'Publishing and versions' },
  { id: 'review', title: 'Review' },
  { id: 'troubleshooting', title: 'Troubleshooting' },
];

// ---- small diagram primitives ------------------------------------------------------

function Node({ icon: Icon, title, sub, tone = 'default' }) {
  const tones = {
    default: 'border-border bg-card',
    primary: 'border-primary/60 bg-primary/10',
    muted: 'border-border/60 bg-card/50',
  };
  return (
    <div className={`rounded-md border px-3 py-2 flex items-start gap-2 min-w-[130px] max-w-[200px] ${tones[tone]}`}>
      {Icon && <Icon className={`w-4 h-4 mt-0.5 shrink-0 ${tone === 'primary' ? 'text-primary' : 'text-muted'}`} />}
      <div>
        <p className="text-sm text-foreground font-medium leading-tight">{title}</p>
        {sub && <p className="text-[11px] text-muted leading-snug mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

/** Left-to-right steps that wrap on small screens (arrows stay with the step before them). */
function Flow({ steps }) {
  return (
    <div className="flex flex-wrap items-center gap-y-2">
      {steps.map((s, i) => (
        <div key={s.title} className="flex items-center gap-2 pr-2">
          <Node {...s} />
          {i < steps.length - 1 && <ArrowRight className="w-4 h-4 text-muted shrink-0" />}
        </div>
      ))}
    </div>
  );
}

/** A labelled row of a multi-stage diagram. */
function Stage({ label, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      {children}
    </div>
  );
}

// The API the bridge should call: same origin when hosted, the dev API port locally.
const API_ORIGIN =
  import.meta.env.VITE_API_URL ||
  (import.meta.env.DEV ? 'http://127.0.0.1:8000' : typeof window !== 'undefined' ? window.location.origin : 'https://zeno.example.com');
const APP_ORIGIN = typeof window !== 'undefined' ? window.location.origin : 'https://zeno.example.com';

function Figure({ children, caption }) {
  return (
    <figure className="flex flex-col gap-2 my-4">
      <div className="rounded-lg border border-border bg-[#0d0d0d] p-4 overflow-x-auto">{children}</div>
      {caption && <figcaption className="text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}

function Shot({ src, alt, caption }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  return (
    <figure className="flex flex-col gap-2 my-4">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        onError={() => setFailed(true)}
        className="rounded-lg border border-border w-full"
      />
      {caption && <figcaption className="text-xs text-muted">{caption}</figcaption>}
    </figure>
  );
}

function Section({ id, title, children }) {
  return (
    <section id={id} className="scroll-mt-24 flex flex-col gap-3 pb-10 border-b border-border/60">
      <h2 className="text-2xl font-serif text-foreground">{title}</h2>
      <div className="text-sm text-foreground/85 leading-relaxed flex flex-col gap-3 max-w-3xl">{children}</div>
    </section>
  );
}

function Steps({ items }) {
  return (
    <ol className="flex flex-col gap-2">
      {items.map((item, i) => (
        <li key={i} className="flex gap-3">
          <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center shrink-0 mt-0.5">{i + 1}</span>
          <span>{item}</span>
        </li>
      ))}
    </ol>
  );
}

const Code = ({ children }) => (
  <pre className="text-xs bg-[#111] border border-border rounded-md p-3 overflow-x-auto text-foreground/90">{children}</pre>
);

const ROLE_ROWS = [
  ['See projects, tasks, schedule, breakdown', true, true, true, true],
  ['Work on assigned tasks, publish from Blender', true, true, true, true],
  ['Report issues from the DCC palette', true, true, true, true],
  ['Create projects, assets, shots, tasks', false, true, true, true],
  ['Edit task templates, casting, schedule, milestones', false, true, true, true],
  ['Invite people', false, true, true, true],
  ['Change roles, deactivate people, studio settings', false, false, false, true],
];

// ---- page ---------------------------------------------------------------------------

export function Guide() {
  const [active, setActive] = useState(SECTIONS[0].id);

  // Highlight the section being read; honour #anchors such as /guide#connect-dcc.
  // The page scrolls inside the layout's <main>, not the window.
  useEffect(() => {
    const hash = window.location.hash.slice(1);
    if (hash) document.getElementById(hash)?.scrollIntoView();
    const scroller = document.querySelector('main') || window;
    const onScroll = () => {
      const line = window.innerHeight * 0.3;
      let current = SECTIONS[0].id;
      SECTIONS.forEach((sec) => {
        const el = document.getElementById(sec.id);
        if (el && el.getBoundingClientRect().top <= line) current = sec.id;
      });
      setActive(current);
    };
    onScroll();
    scroller.addEventListener('scroll', onScroll, { passive: true });
    return () => scroller.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <div className="flex gap-10">
      <nav className="hidden xl:block w-56 shrink-0">
        <div className="sticky top-4 flex flex-col gap-1">
          <p className="text-xs uppercase tracking-wider text-muted mb-2">On this page</p>
          {SECTIONS.map((s) => (
            <a
              key={s.id}
              href={`#${s.id}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById(s.id)?.scrollIntoView({ behavior: 'smooth' });
                window.history.replaceState(null, '', `#${s.id}`);
              }}
              className={`text-sm px-2 py-1 rounded ${active === s.id ? 'text-primary bg-primary/10' : 'text-muted hover:text-foreground'}`}
            >
              {s.title}
            </a>
          ))}
        </div>
      </nav>

      <article className="flex-1 min-w-0 flex flex-col gap-10">
        <header>
          <p className="text-xs uppercase tracking-wider text-muted">Guide</p>
          <h1 className="text-4xl font-serif text-foreground flex items-center gap-3">
            <BookOpen className="w-8 h-8 text-primary" /> Using Zeno
          </h1>
          <p className="text-muted mt-2 max-w-2xl">
            Zeno plans and tracks an animation production — projects, assets, shots, tasks, schedule and team — and connects it
            to the artists&apos; DCCs so publishing and opening work happens from one place. This guide walks through it in the
            order you will use it.
          </p>
        </header>

        <Section id="overview" title="How Zeno fits together">
          <p>
            Producers and supervisors plan in the <b>dashboard</b>. Artists open their work from it, and publish back from
            Blender with the Zeno add-on. Everything goes through the Zeno server, which keeps your studio&apos;s data private
            from every other studio on it.
          </p>
          <Figure caption="The pieces of Zeno and how they talk to each other.">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1.2fr_auto_1fr] gap-3 items-center min-w-[640px]">
              <div className="flex flex-col gap-2">
                <Node icon={Monitor} title="Dashboard" sub="Plan, schedule, review (browser)" tone="primary" />
                <Node icon={Clapperboard} title="Blender + Zeno add-on" sub="Open, publish, report issues" />
                <Node icon={Upload} title="Zeno Bridge" sub="Local helper behind “Open in DCC”" tone="muted" />
              </div>
              <ArrowRight className="w-5 h-5 text-muted hidden md:block" />
              <div className="flex flex-col gap-2">
                <Node icon={Server} title="Zeno server (API)" sub="Projects, tasks, schedule, versions, permissions — one private workspace per studio" tone="primary" />
              </div>
              <ArrowRight className="w-5 h-5 text-muted hidden md:block" />
              <div className="flex flex-col gap-2">
                <Node icon={Database} title="Database" sub="Production data" />
                <Node icon={HardDrive} title="File storage" sub="Published files, deduplicated (server disk or S3)" />
              </div>
            </div>
          </Figure>
        </Section>

        <Section id="quick-start" title="Quick start">
          <p>For the person setting up the studio (you&apos;ll have the <b>Pipeline</b> admin role):</p>
          <Steps
            items={[
              <>Create your studio on the sign-up page, or join one with an invite link.</>,
              <>
                <Link className="text-primary hover:underline" to="/projects/new">Create a project</Link> from a template — short film,
                series, commercial, music video or game cinematic.
              </>,
              <>
                <Link className="text-primary hover:underline" to="/team">Invite your team</Link> with links (or email) and the right
                role for each person.
              </>,
              <>
                Add characters, props and environments on <Link className="text-primary hover:underline" to="/entities">Entities</Link>.
                Their tasks are created for you.
              </>,
              <>
                Tick who appears in which shot on the <Link className="text-primary hover:underline" to="/breakdown">Breakdown</Link>.
              </>,
              <>
                Press <b>Auto-schedule</b> on the <Link className="text-primary hover:underline" to="/schedule">Schedule</Link> and see
                whether you&apos;ll make the delivery date.
              </>,
            ]}
          />
          <p>
            Your <Link className="text-primary hover:underline" to="/getting-started">Getting started</Link> checklist tracks these
            steps for you.
          </p>
        </Section>

        <Section id="workflow" title="The production workflow">
          <p>Each step feeds the next, so most of the setup is automatic:</p>
          <Figure caption="From a template to a scheduled, trackable production.">
            <div className="flex flex-col gap-4 min-w-[600px]">
              <Stage label="Plan">
                <Flow
                  steps={[
                    { icon: Clapperboard, title: 'Project template', sub: 'structure + milestones', tone: 'primary' },
                    { icon: FileBox, title: 'Assets & shots', sub: 'from the wizard or Entities' },
                    { icon: LayoutTemplate, title: 'Tasks', sub: 'created by task templates' },
                  ]}
                />
              </Stage>
              <Stage label="Organize">
                <Flow
                  steps={[
                    { icon: Grid3x3, title: 'Casting', sub: 'who is in each shot' },
                    { icon: CalendarRange, title: 'Schedule', sub: 'dates from dependencies', tone: 'primary' },
                  ]}
                />
              </Stage>
              <Stage label="Make">
                <Flow
                  steps={[
                    { icon: Monitor, title: 'Open in DCC', sub: 'from a task or asset' },
                    { icon: Upload, title: 'Publish', sub: 'new version from Blender' },
                    { icon: PlaySquare, title: 'Review', sub: 'notes on frames, approve or send back' },
                    { icon: Check, title: 'Done', sub: 'task + schedule update', tone: 'primary' },
                  ]}
                />
              </Stage>
            </div>
          </Figure>
        </Section>

        <Section id="roles" title="Roles and permissions">
          <p>Everyone in a studio has one role. Admins can change it on the Team page.</p>
          <div className="overflow-x-auto">
            <table className="text-sm w-full min-w-[560px]">
              <thead className="text-xs uppercase tracking-wider text-muted text-left">
                <tr>
                  <th className="py-2 pr-4" />
                  <th className="py-2 px-2">Artist</th>
                  <th className="py-2 px-2">Supervisor</th>
                  <th className="py-2 px-2">Production</th>
                  <th className="py-2 px-2">Pipeline (admin)</th>
                </tr>
              </thead>
              <tbody>
                {ROLE_ROWS.map(([label, ...cells]) => (
                  <tr key={label} className="border-t border-border">
                    <td className="py-2 pr-4">{label}</td>
                    {cells.map((ok, i) => (
                      <td key={i} className="py-2 px-2 text-center">
                        {ok ? <Check className="w-4 h-4 text-success inline" /> : <span className="text-muted">—</span>}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Section>

        <Section id="new-project" title="Set up a project">
          <p>
            <Link className="text-primary hover:underline" to="/projects/new">New project</Link> (also in the project menu) walks through
            four steps:
          </p>
          <Steps
            items={[
              <><b>Template</b> — picks the structure, frame rate, resolution and milestones.</>,
              <><b>Details</b> — name, a short code (used in file names and <code>asset://</code> links), start and delivery dates.</>,
              <><b>Structure</b> — how many episodes, sequences and shots, and frames per shot. Shots are numbered EP01 / SQ010 / SH0010 with frames from 1001.</>,
              <><b>Starter assets</b> — list the characters, props and environments you already know about.</>,
            ]}
          />
          <p>Milestones are spread across your dates (e.g. “Animatic approved” at 25%, “Final delivery” on the delivery date). You can move them on the schedule.</p>
          <Shot src="/guide/new-project.jpg" alt="New project wizard" caption="Choosing a template in the new-project wizard." />
        </Section>

        <Section id="templates" title="Task templates">
          <p>
            A task template is the recipe of tasks for one kind of thing. When you add a <b>character</b>, Zeno creates its
            Concept → Model → Texture → Rig → Lookdev tasks; every <b>shot</b> gets Layout → Animation → Lighting → Render → Comp.
          </p>
          <p>
            On <Link className="text-primary hover:underline" to="/templates">Templates</Link> you can change the steps, how many days each
            takes, and what each step waits for. The star marks the template used automatically for its type. <b>Apply to
            existing</b> adds missing tasks to assets and shots you already have.
          </p>
          <Figure caption="A character template: each step waits for the one before it.">
            <Flow
              steps={[
                { title: 'Concept', sub: '3 days' },
                { title: 'Model', sub: '5 days' },
                { title: 'Texture', sub: '3 days' },
                { title: 'Rig', sub: '5 days', tone: 'primary' },
                { title: 'Lookdev', sub: '2 days' },
              ]}
            />
          </Figure>
          <Shot src="/guide/templates.jpg" alt="Task template editor" caption="The template editor: steps, durations and “starts after” links." />
        </Section>

        <Section id="breakdown" title="Breakdown (casting)">
          <p>
            The <Link className="text-primary hover:underline" to="/breakdown">Breakdown</Link> grid shows which assets appear in which shots.
            Click a square to cast an asset in a shot; click a sequence row to cast it in the whole sequence. The numbers under
            each asset show how many shots use it — handy for spotting your most important assets.
          </p>
          <p>Casting also tells the schedule what each shot is waiting for (next section).</p>
          <Shot src="/guide/breakdown.jpg" alt="Breakdown grid" caption="Characters, props and environments cast across a sequence." />
        </Section>

        <Section id="schedule" title="Schedule">
          <p>
            The <Link className="text-primary hover:underline" to="/schedule">Schedule</Link> is a timeline of every task, grouped by
            asset and shot. Arrows show what waits for what. <b>Auto-schedule</b> places every task on working days (Mon–Fri) as
            early as its dependencies allow and tells you the finish date compared with your delivery.
          </p>
          <Figure caption="How dependencies chain: a shot’s animation waits for the rig of every character cast in it.">
            <div className="flex flex-col gap-3 min-w-[560px]">
              <Flow steps={[{ title: 'Nono · Model' }, { title: 'Nono · Texture' }, { title: 'Nono · Rig', tone: 'primary' }]} />
              <div className="flex items-center gap-2 pl-[330px]">
                <ArrowDown className="w-4 h-4 text-primary" />
                <span className="text-[11px] text-muted">casting: Nono is in SH0010</span>
              </div>
              <Flow steps={[{ title: 'SH0010 · Layout' }, { title: 'SH0010 · Animation', tone: 'primary' }, { title: 'SH0010 · Lighting' }]} />
            </div>
          </Figure>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li><b>Move</b> a bar by dragging it; <b>resize</b> it by dragging its right edge.</li>
            <li><b>Click</b> a bar to see its dates, what it waits for and what it blocks, and to add or remove links.</li>
            <li>A <span className="text-danger">red arrow</span> means a task starts before the thing it waits for has finished.</li>
            <li>Diamonds are milestones (yellow = review, blue = milestone, green-yellow = delivery). Click one to edit it or mark it done.</li>
            <li>“Keep dates I already set” in Auto-schedule leaves your hand-placed bars alone.</li>
          </ul>
          <Shot src="/guide/schedule.jpg" alt="Schedule timeline" caption="The timeline after Auto-schedule, with a task’s links highlighted." />
        </Section>

        <Section id="team" title="Team and invites">
          <p>
            On <Link className="text-primary hover:underline" to="/team">Team</Link>, choose a role (and optionally a department and
            project) and create an invite. You get a link to share in Discord, Slack or a DM; if your server has email set up,
            Zeno can email it for you. Links expire after 14 days and work once. Lost one? Press <b>New link</b>.
          </p>
          <p>The person opens the link, picks a name and password, and lands in your studio with the right permissions.</p>
          <Shot src="/guide/team.jpg" alt="Team page" caption="Creating an invite link, with pending invites and members below." />
        </Section>

        <Section id="connect-dcc" title="Connect Blender">
          <p>
            <b>Zeno Bridge</b> is a small helper that runs on each artist&apos;s computer. When you press <b>Open in DCC</b>, the
            dashboard asks the bridge to start Blender with the Zeno add-on loaded and already signed in as you.
          </p>
          <Figure caption="What happens when you press “Open in DCC”.">
            <Flow
              steps={[
                { icon: Monitor, title: 'Dashboard', sub: 'asks the server for a one-time launch ticket' },
                { icon: Server, title: 'Zeno server', sub: 'ticket = what to open + a 24 h token for you' },
                { icon: Upload, title: 'Zeno Bridge', sub: 'swaps the ticket, starts Blender' },
                { icon: Clapperboard, title: 'Blender', sub: 'add-on loaded, signed in', tone: 'primary' },
              ]}
            />
          </Figure>
          <Steps
            items={[
              <>Install Zeno Bridge (your admin can share the installer) and start it; it runs in the background from then on.</>,
              <>
                Tell it where Blender is and which Zeno server to use, in <code>~/.config/zeno-bridge/config.json</code>:
              </>,
            ]}
          />
          <Code>{`{
  "api_base_url": "${API_ORIGIN}",
  "allowed_origins": ["${APP_ORIGIN}"],
  "dcc_paths": { "blender": "/Applications/Blender.app/Contents/MacOS/Blender" },
  "executable_allowlist": ["/Applications/Blender.app/Contents/MacOS/Blender"]
}`}</Code>
          <p>
            Starting Blender yourself instead? Create a token on{' '}
            <Link className="text-primary hover:underline" to="/account"><KeyRound className="w-3.5 h-3.5 inline" /> Account → API tokens</Link>{' '}
            and paste it in Blender&apos;s <i>Preferences → Add-ons → Chimera Zeno → API Token</i>.
          </p>
        </Section>

        <Section id="publishing" title="Publishing and versions">
          <p>
            Publishing from Blender uploads the file and records a new <b>version</b> of the asset (v1, v2, …), linked to your task.
            Files are stored by their content, split into chunks: when you publish v2, only the chunks that changed since v1 are
            uploaded, so iterating on big scenes stays fast.
          </p>
          <Figure caption="Only what changed is uploaded.">
            <div className="flex flex-col gap-2 min-w-[520px] text-xs">
              {[
                ['v1', [1, 1, 1, 1, 1, 1, 1, 1]],
                ['v2', [0, 0, 1, 0, 0, 0, 1, 0]],
              ].map(([label, chunks]) => (
                <div key={label} className="flex items-center gap-2">
                  <span className="w-6 text-muted">{label}</span>
                  {chunks.map((isNew, i) => (
                    <span key={i} className={`w-12 h-6 rounded-sm border ${isNew ? 'bg-primary/60 border-primary' : 'bg-card border-border'}`} />
                  ))}
                  <span className="text-muted ml-2">{label === 'v1' ? 'all chunks uploaded' : '2 new chunks uploaded, 6 reused'}</span>
                </div>
              ))}
            </div>
          </Figure>
          <p>
            Chunking is configurable per file type in <b>Settings → Storage workflow</b> (pipeline role): turn it off entirely, or
            store some formats (say <code>.fbx</code>) as whole files while their algorithm matures. Each type shows its status
            (stable, beta, experimental), and every version records which strategy it used.
          </p>
          <p>
            To get feedback, submit a playblast or render for the task: that is what supervisors watch and approve (next
            section). The task status follows their decision.
          </p>
        </Section>

        <Section id="review" title="Review">
          <p>
            Every playblast or render submitted for a task becomes its next <b>revision</b> (v001, v002, …). Reviewers watch it
            frame by frame, draw on the picture and leave notes pinned to frames. Notes belong to the <i>task</i>, not to one
            revision, so when the artist sends v002 every open note from v001 is still there, at the same frames, waiting to be
            checked off.
          </p>
          <Figure caption="The review loop. Notes travel with the shot until the reviewer verifies them.">
            <div className="flex flex-col gap-4 min-w-[640px]">
              <Stage label="Artist">
                <Flow
                  steps={[
                    { icon: Clapperboard, title: 'Submit for review', sub: 'Blender: Zeno → Submit for Review, or upload here' },
                    { icon: Server, title: 'Converted', sub: 'frame-exact proxy, thumbnail, filmstrip' },
                  ]}
                />
              </Stage>
              <Stage label="Reviewer">
                <Flow
                  steps={[
                    { icon: PenLine, title: 'Notes on frames', sub: 'draw, type, pick a frame range' },
                    { icon: RotateCcw, title: 'Request changes', sub: 'task goes back to the artist' },
                  ]}
                />
              </Stage>
              <Stage label="Artist">
                <Flow
                  steps={[
                    { icon: MessageSquare, title: 'Notes in Blender', sub: 'jump to frame, timeline markers' },
                    { icon: Check, title: 'Mark fixed', sub: 'then submit v002' },
                  ]}
                />
              </Stage>
              <Stage label="Reviewer">
                <Flow
                  steps={[
                    { icon: PlaySquare, title: 'Compare v002 with v001', sub: 'wipe, side by side or flip' },
                    { icon: Check, title: 'Verify and approve', sub: 'task done', tone: 'primary' },
                  ]}
                />
              </Stage>
            </div>
          </Figure>
          <Shot src="/guide/review-player.jpg" alt="Review player" caption="A note with a drawing on frames 1018–1024. The timeline shows every note; red is open, amber is fixed, green is verified." />

          <h3 className="text-lg font-serif text-foreground mt-2">Notes: open, fixed, verified</h3>
          <Figure>
            <Flow
              steps={[
                { title: 'Open', sub: 'the reviewer’s note' },
                { title: 'Fixed', sub: 'artist: “done in v002”' },
                { title: 'Verified', sub: 'reviewer checked it', tone: 'primary' },
              ]}
            />
          </Figure>
          <ul className="list-disc pl-5 flex flex-col gap-1">
            <li>Only the reviewer (or the note&apos;s author) can verify or reopen a note. Approving verifies every note marked fixed.</li>
            <li>Untick <b>needs a fix</b> for a plain comment (“lovely timing”) that should not be tracked.</li>
            <li>A note from an earlier revision says <i>from v001</i>. If its frame is outside the new revision (the shot was trimmed or retimed), Zeno says so; check it by eye.</li>
            <li>Submit with your scene&apos;s frame numbers (e.g. starting at 1001). Blender does this for you; on upload, set <b>First frame number</b>.</li>
          </ul>

          <h3 className="text-lg font-serif text-foreground mt-2">Image sequences: unchanged frames are stored once</h3>
          <p>
            Select or drop all frames of a render (e.g. <code>sh010.1001.exr</code> … <code>sh010.1072.exr</code>), or tick <b>As image
            sequence</b> in Blender&apos;s Submit for Review. Each frame is stored by its content, so when v002 only re-renders frames
            1018–1024, the other frames are not uploaded or stored again; the review page shows how much was reused. Use movies for
            quick playblasts (much smaller), sequences for renders you keep anyway.
          </p>

          <h3 className="text-lg font-serif text-foreground mt-2">Compare versions</h3>
          <p>
            Pick <b>Wipe</b>, <b>Side by side</b> or <b>Flip A/B</b> under the player. B defaults to the last approved revision (or the
            previous one). Both sides stay on the same scene frame while you step or play.
          </p>
          <Shot src="/guide/review-compare.jpg" alt="Side-by-side compare" caption="v002 against v001 on frame 1021." />

          <h3 className="text-lg font-serif text-foreground mt-2">Share with a client</h3>
          <p>
            Press <b>Share</b> on a review (or select several on the Reviews page) to make a link for someone without an account,
            optionally with a password and an expiry. Clients can watch, draw, leave notes and approve or ask for changes. They
            never see your internal notes; their notes appear in your list marked <i>(client)</i>, and their approval is recorded
            for the supervisor to act on. Revoke links any time under Reviews → Client links.
          </p>
          <Shot src="/guide/review-client.jpg" alt="Client review page" caption="What the client sees." />

          <h3 className="text-lg font-serif text-foreground mt-2">Keyboard</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1 text-sm">
            {[
              ['Space / K', 'play · pause'],
              ['← →', 'one frame (Shift: 10)'],
              ['J / L', 'play backwards · forwards (L again: faster)'],
              ['I / O / P', 'in point · out point · loop'],
              ['[ ]', 'previous · next open note'],
              ['N', 'write a note on this frame'],
              ['D', 'draw (Esc to stop, ⌘Z to undo)'],
              ['C / B', 'cycle compare mode · flip A/B'],
              ['Home / End', 'first · last frame'],
              ['F / H / M', 'full screen · info overlay · mute'],
            ].map(([k, v]) => (
              <div key={k} className="flex gap-3">
                <kbd className="px-1.5 py-0.5 rounded bg-card border border-border font-mono text-foreground text-xs whitespace-nowrap">{k}</kbd>
                <span className="text-muted">{v}</span>
              </div>
            ))}
          </div>

          <h3 className="text-lg font-serif text-foreground mt-2">Full quality: open the original in DJV or OpenRV</h3>
          <p>
            The browser plays an H.264 proxy (up to 1920 px, Rec.709). For pixel-level or colour-critical checks, install a
            viewer such as DJV or OpenRV and add it to the Zeno Bridge config. An <b>Open in DJV</b> button then appears on every
            review; it downloads the original upload and opens it locally.
          </p>
          <Code>{`"viewers": { "djv": "/Applications/DJV.app/Contents/MacOS/djv" },
"executable_allowlist": ["/Applications/DJV.app/Contents/MacOS/djv", "…"]`}</Code>
        </Section>

        <Section id="troubleshooting" title="Troubleshooting">
          <dl className="flex flex-col gap-3">
            {[
              ['“Open in DCC” does nothing', 'Check Zeno Bridge is running: open http://127.0.0.1:17373/health — it should say {"ok": true}. If the browser shows “Origin not allowed”, add this dashboard’s address to allowed_origins in the bridge config.'],
              ['Blender opens but publishing says “Missing bearer token”', 'Blender was started without a token. Use Open in DCC, or paste an API token in the add-on preferences.'],
              ['Auto-schedule says the dependencies contain a loop', 'Two tasks wait for each other. Open the schedule, click the tasks named in your recent links, and remove one link.'],
              ['A person can’t see Team or Templates', 'Those pages are for supervisors, production and pipeline. An admin can change their role on Team.'],
              ['Invite link says it is not valid', 'It was already used, revoked, expired, or a newer link replaced it. Create a new link on Team.'],
              ['A review stays on “Converting…”', 'The server converts uploads with ffmpeg, one at a time; long renders take a while. If it says the conversion failed, the file may be damaged or in an unusual format: export an MP4 or MOV and submit again.'],
              ['No “Open in DJV” button', 'Zeno Bridge must be running on your computer and list the viewer under “viewers” (and executable_allowlist) in its config.'],
            ].map(([q, a]) => (
              <div key={q}>
                <dt className="text-foreground font-medium">{q}</dt>
                <dd className="text-muted">{a}</dd>
              </div>
            ))}
          </dl>
          <p className="flex items-center gap-2 text-muted"><Cloud className="w-4 h-4" /> Running your own Zeno server? See <code>zeno-infra/deploy/HOSTING.md</code>.</p>
          <p className="flex items-center gap-2 text-muted"><Users className="w-4 h-4" /> Still stuck? Raise an issue from the Issues page or the Blender palette.</p>
        </Section>
      </article>
    </div>
  );
}

export default Guide;
