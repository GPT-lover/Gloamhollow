import { PLAYER as P, PROJ } from '/shared/constants.js';
import { moveBody, overlap } from '/shared/physics.js';
import { PLAYER_SPAWNS } from '/shared/map.js';

const sign = v => (v < 0 ? -1 : 1);

// A locally controlled player. Physics & hit detection run on the owning client.
export class Player {
  constructor(pid, ctrl) {
    this.pid = pid;
    this.ctrl = ctrl;
    this.aq = 0;
    this.djSeq = 0;
    this.respawn();
  }

  respawn() {
    const sp = PLAYER_SPAWNS[this.pid % PLAYER_SPAWNS.length];
    Object.assign(this, {
      x: sp.x, y: sp.y - 2, vx: 0, vy: 0, w: P.w, h: P.h, face: this.pid === 0 ? 1 : -1,
      onGround: false, plat: null, dropT: 0,
      hp: P.maxHp, lu: 0, dn: false,
      coyote: 0, jumpBuf: 0, jumping: false, canDouble: true, airDash: true,
      dashT: 0, dashCd: 0, dashDir: 1,
      atk: null, atkCd: 0, atkT: 99,
      recoilT: 0, recoilV: 0,
      inv: 0, hurtT: 0, focusT: 0, castT: 0, landT: 0, djT: 0, runT: 0,
    });
  }

  revive() {
    this.dn = false;
    this.hp = Math.max(this.hp, P.reviveHp);
    this.inv = 2;
    this.vy = -500;
  }

  hurtBox() { return { x: this.x - 12, y: this.y - 50, w: 24, h: 46 }; }

  update(dt, view, G) {
    const c = this.ctrl;
    this.atkT += dt;
    this.inv = Math.max(0, this.inv - dt);
    this.landT = Math.max(0, this.landT - dt);
    this.djT = Math.max(0, this.djT - dt);
    this.dropT -= dt;

    if (this.dn) {
      this.atk = null; this.dashT = 0; this.focusT = 0;
      this.vx *= Math.pow(0.02, dt);
      this.vy = Math.min(this.vy + P.gravity * dt, P.maxFall);
      moveBody(this, dt);
      return;
    }

    this.dashCd -= dt;
    this.atkCd -= dt;
    this.castT = Math.max(0, this.castT - dt);
    this.hurtT = Math.max(0, this.hurtT - dt);
    this.recoilT = Math.max(0, this.recoilT - dt);
    this.jumpBuf -= dt;

    const ax = c.axis();
    const canAct = this.hurtT <= 0;
    const jp = canAct && c.pressed('jump');
    if (jp) this.jumpBuf = P.jumpBuffer;

    // --- focus (heal) ---
    const wantFocus = canAct && c.down('focus') && this.onGround && this.lu >= P.focusCost && this.hp < P.maxHp && this.dashT <= 0;
    if (wantFocus) {
      if (this.focusT === 0) G.onFocusStart(this);
      this.focusT += dt;
      if (this.focusT >= P.focusTime) {
        this.focusT = 0.001;
        this.hp++;
        this.lu -= P.focusCost;
        G.onHeal(this);
      }
    } else this.focusT = 0;
    const focusing = this.focusT > 0;

    if (canAct && !focusing) {
      // --- jump / drop / double jump ---
      if (this.jumpBuf > 0) {
        if (this.onGround && this.plat && c.down('down')) {
          this.dropT = 0.22; this.jumpBuf = 0; this.onGround = false; this.vy = 120;
        } else if (this.onGround || this.coyote > 0) {
          this.vy = -P.jumpV; this.jumping = true; this.coyote = 0; this.jumpBuf = 0; this.onGround = false;
          G.onJump(this);
        } else if (jp && this.canDouble && this.dashT <= 0) {
          this.vy = -P.doubleJumpV; this.jumping = true; this.canDouble = false; this.jumpBuf = 0;
          this.djT = 0.35; this.djSeq++;
          G.onDoubleJump(this);
        }
      }
      if (this.jumping && this.vy < 0 && !c.down('jump')) { this.vy *= P.jumpCut; this.jumping = false; }

      // --- dash ---
      if (c.pressed('dash') && this.dashCd <= 0 && this.airDash && this.castT <= 0) {
        this.dashDir = ax || this.face;
        this.face = this.dashDir;
        this.dashT = P.dashTime;
        this.dashCd = P.dashCooldown;
        if (!this.onGround) this.airDash = false;
        this.vy = 0;
        this.jumping = false;
        G.onDash(this);
      }

      // --- nail ---
      if (c.pressed('attack') && this.atkCd <= 0 && this.castT <= 0) {
        let dir = 'side';
        if (c.down('up')) dir = 'up';
        else if (c.down('down') && !this.onGround) dir = 'down';
        if (ax && this.dashT <= 0) this.face = ax;
        this.atk = { dir, hits: new Set() };
        this.atkT = 0;
        this.aq++;
        this.atkCd = P.attackCooldown;
        G.onSlash(this, dir);
      }

      // --- spell ---
      if (c.pressed('spell') && this.lu >= P.spellCost && this.castT <= 0) {
        if (ax) this.face = ax;
        this.lu -= P.spellCost;
        this.castT = 0.34;
        this.dashT = 0;
        G.session.spell(this.x + this.face * 34, this.y - 32, this.face);
        G.onCast(this);
      }
    }

    // --- horizontal velocity ---
    if (this.hurtT > 0) this.vx *= Math.pow(0.05, dt);
    else if (this.dashT > 0) this.vx = this.dashDir * P.dashSpeed;
    else if (this.castT > 0) this.vx = -this.face * 140 * (this.castT / 0.34);
    else if (focusing) this.vx = 0;
    else {
      this.vx = ax * P.run;
      if (ax && !(this.atk && this.atkT < 0.2)) this.face = ax;
      else if (ax) this.face = ax;
      if (this.recoilT > 0) this.vx = this.recoilV;
    }

    // --- vertical ---
    if (this.dashT > 0) { this.vy = 0; this.dashT -= dt; }
    else if (this.castT > 0.2) this.vy = Math.min(this.vy, 30);
    else this.vy = Math.min(this.vy + P.gravity * dt, P.maxFall);
    if (this.vy >= 0) this.jumping = false;

    const wasGround = this.onGround;
    const fallV = this.vy;
    moveBody(this, dt);
    if (this.hitCeil) this.jumping = false;
    if (this.onGround) {
      this.coyote = P.coyote; this.canDouble = true; this.airDash = true;
      if (!wasGround && fallV > 300) { this.landT = 0.13; G.onLand(this, fallV); }
    } else this.coyote -= dt;
    if (this.onGround && Math.abs(this.vx) > 10) this.runT += dt;

    // --- nail hits (client-authoritative) ---
    if (this.atk && this.atkT < P.attackActive) this.checkNail(view, G);
    if (this.atk && this.atkT > 0.3) this.atk = null;

    // --- taking damage (judged against what this client sees) ---
    if (this.inv <= 0) this.checkHurt(view, G);
  }

  nailBox() {
    const d = this.atk.dir;
    if (d === 'up') return { x: this.x - 42, y: this.y - P.h - 100, w: 84, h: 118 };
    if (d === 'down') return { x: this.x - 40, y: this.y - 24, w: 80, h: 108 };
    return this.face > 0 ? { x: this.x + 4, y: this.y - 68, w: 108, h: 70 } : { x: this.x - 112, y: this.y - 68, w: 108, h: 70 };
  }

  checkNail(view, G) {
    const b = this.nailBox();
    let landed = false;
    for (const m of view.mobs) {
      if (m.s === 'spawn' || this.atk.hits.has(m.id)) continue;
      if (overlap(b.x, b.y, b.w, b.h, m.x - m.w / 2, m.y - m.h, m.w, m.h)) {
        this.atk.hits.add(m.id);
        landed = true;
        const kx = this.atk.dir === 'side' ? this.face : sign(m.x - this.x) * 0.4;
        G.session.hit(m.id, 1, kx);
        G.onNailHit(this, m, this.atk.dir);
        this.lu = Math.min(P.lumenMax, this.lu + P.lumenPerHit);
      }
    }
    for (const pr of view.proj) {
      if (pr.o !== 'm' || pr.k !== 'glob' || this.atk.hits.has('p' + pr.id)) continue;
      if (overlap(b.x, b.y, b.w, b.h, pr.x - pr.w / 2, pr.y - pr.h / 2, pr.w, pr.h)) {
        this.atk.hits.add('p' + pr.id);
        landed = true;
        G.session.pop(pr.id);
        G.onParry(this, pr);
      }
    }
    if (landed) {
      if (this.atk.dir === 'down') {
        this.vy = -P.pogoV; this.canDouble = true; this.airDash = true; this.dashCd = 0; this.jumping = false;
      } else if (this.atk.dir === 'side') {
        this.recoilT = 0.09; this.recoilV = -this.face * P.recoil;
      }
    }
  }

  checkHurt(view, G) {
    const hb = this.hurtBox();
    for (const m of view.mobs) {
      if (m.s === 'spawn') continue;
      const mx = m.x - m.w * 0.4, my = m.y - m.h * 0.88, mw = m.w * 0.8, mh = m.h * 0.82;
      if (overlap(hb.x, hb.y, hb.w, hb.h, mx, my, mw, mh)) return this.hurt(1, m.x, G);
    }
    for (const z of view.hz) {
      if (overlap(hb.x, hb.y, hb.w, hb.h, z.x, z.y, z.w, z.h)) return this.hurt(z.d, z.x + z.w / 2, G);
    }
    for (const pr of view.proj) {
      if (pr.o !== 'm') continue;
      const def = PROJ[pr.k];
      const top = pr.k === 'shock' ? pr.y - def.h : pr.y - def.h / 2;
      if (overlap(hb.x, hb.y, hb.w, hb.h, pr.x - def.w / 2, top, def.w, def.h)) {
        G.session.pop(pr.id);
        return this.hurt(def.dmg || 1, pr.x - pr.vx, G);
      }
    }
  }

  hurt(dmg, fromX, G) {
    if (this.inv > 0 || this.dn) return;
    this.hp = Math.max(0, this.hp - dmg);
    this.inv = P.invuln;
    this.hurtT = P.hurtStun;
    this.vx = sign(this.x - fromX) * 430;
    this.vy = -560;
    this.atk = null; this.dashT = 0; this.focusT = 0; this.castT = 0; this.jumping = false;
    if (this.hp <= 0) { this.dn = true; this.vy = -400; G.onDown(this); }
    else G.onHurt(this, dmg);
  }

  netState() {
    return {
      x: this.x, y: this.y, vx: this.vx, vy: this.vy, f: this.face, hp: this.hp, lu: this.lu, dn: this.dn,
      ad: this.atk ? this.atk.dir : (this.lastDir || ''), aq: this.aq, fc: this.focusT > 0 ? Math.min(1, this.focusT / P.focusTime) : 0,
      ds: this.dashT > 0 ? 1 : 0, iv: this.inv > 0 ? 1 : 0, og: this.onGround ? 1 : 0, cs: this.castT > 0 ? 1 : 0,
      dj: this.djSeq, an: this.hurtT > 0 ? 'hurt' : '',
    };
  }

  renderState() {
    if (this.atk) this.lastDir = this.atk.dir;
    return {
      x: this.x, y: this.y, vx: this.vx, vy: this.vy, f: this.face, og: this.onGround, dn: this.dn,
      atkDir: this.lastDir || 'side', atkT: this.atkT, ds: this.dashT > 0, fc: this.focusT > 0 ? Math.min(1, this.focusT / P.focusTime) : 0,
      iv: this.inv > 0, cs: this.castT > 0, hurt: this.hurtT > 0, landT: this.landT, djT: this.djT, runT: this.runT, hp: this.hp, lu: this.lu,
    };
  }
}
