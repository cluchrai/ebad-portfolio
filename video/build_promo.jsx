/*  Muhammad Ebad Hafeez - portfolio promo video, built entirely by script.
 *
 *  Run in After Effects 2023+:  File > Scripts > Run Script File... > video/build_promo.jsx
 *  (or:  AfterFX.exe -r video/build_promo.jsx)
 *  It creates video/promo.aep with one comp per scene plus the main comp "00 Promo".
 *  Render:  aerender -project video/promo.aep -comp "00 Promo" -OMtemplate "H.264 - Match Render Settings - 15 Mbps" -output video/out/promo_ae.mp4
 *
 *  Look and feel matches the website: pastel sky, cherry blossom petals, the floating island with
 *  the windmill, game objects (? block, grass block, mushroom, controller, coins) and the HUD.
 *  Assets come from video/assets (avatar frames rendered from blender/ebad_avatar.blend,
 *  site screenshots, project images, photos, and the chiptune track from video/make_audio.py).
 */
(function () {
  var VIDEO = new File($.fileName).parent;
  var A = VIDEO.fsName.replace(/\\/g, "/") + "/assets/";
  var LOG = new File(VIDEO.fsName + "/build_log.txt");
  var FPS = 30, W = 1920, H = 1080, TOTAL = 60;

  // scene layout (seconds) - keep in sync with video/make_audio.py
  var SCENES = [
    ["01 Boot", 0, 4.5],
    ["02 Player Select", 4.5, 7.5],
    ["03 Enter the Island", 12, 6],
    ["04 Inventory", 18, 6.5],
    ["05 Quest Log", 24.5, 13.5],
    ["06 Achievement Unlocked", 38, 9],
    ["07 Power-ups", 47, 6],
    ["08 Thanks for Playing", 53, 7]
  ];

  var C = {
    ink: "16183A", ink2: "474B78", violet: "6A4CFF", violetL: "B3A6FF", violetD: "4B33C9", mint: "1FC7A9",
    sun: "FFB23F", gold: "FFC24B", goldD: "C97A12", goldL: "FFF1D6", pink: "FF6FAE", blossom: "FFA8CF",
    sky1: "A9D8FF", sky2: "E6EEFF", sky3: "FFEAF4", white: "FFFFFF", night1: "0B1033", night2: "2A2160",
    cream: "F4ECE1", grass: "A9DDA0", grassD: "86C77F", grassL: "C3EBB6", lav: "B7A3F0", lavD: "9A84E0",
    red: "FF4B5C", redD: "D93445", brown: "9B6A43", brownD: "7A4F2E", trunk: "9A6B5B"
  };
  var F = { display: "SegoeUIBlack", bold: "SegoeUI-Bold", semi: "SegoeUI-Semibold", reg: "SegoeUI", hud: "Bahnschrift-Bold" };
  var AV_ANCHOR = [438, 1185]; // avatar feet in the rendered frames (900 x 1300)

  var log = [];
  function note(s) { log.push(s); }
  function writeLog() { try { LOG.open("w"); LOG.write(log.join("\n")); LOG.close(); } catch (e) {} }

  // ------------------------------------------------------------------ helpers
  function hex(h) { return [parseInt(h.substr(0, 2), 16) / 255, parseInt(h.substr(2, 2), 16) / 255, parseInt(h.substr(4, 2), 16) / 255]; }
  function hex4(h) { var c = hex(h); c.push(1); return c; }

  var folders = {};
  function folder(name) { if (!folders[name]) folders[name] = app.project.items.addFolder(name); return folders[name]; }
  function comp(name, w, h, dur, fold) {
    var c = app.project.items.addComp(name, w, h, 1, dur, FPS);
    c.parentFolder = folder(fold || "Parts");
    c.bgColor = [0, 0, 0];
    return c;
  }

  function imp(path, fold) {
    var io = new ImportOptions(new File(A + path));
    var it = app.project.importFile(io);
    it.parentFolder = folder(fold || "Assets");
    return it;
  }
  function impSeq(dir, loops) {
    var f = new Folder(A + "avatar/" + dir).getFiles("*.png");
    f.sort();
    var io = new ImportOptions(f[0]);
    io.sequence = true;
    io.forceAlphabetical = true;
    var it = app.project.importFile(io);
    it.mainSource.conformFrameRate = FPS;
    try { it.mainSource.alphaMode = AlphaMode.STRAIGHT; } catch (e) {}
    it.mainSource.loop = loops || 1;
    it.name = "Avatar " + dir;
    it.parentFolder = folder("Assets/Avatar");
    return it;
  }

  function solid(c, name, col) { return c.layers.addSolid(hex(col), name, c.width, c.height, 1, c.duration); }
  function ramp(l, p1, c1, p2, c2, radial) {
    var e = l.property("ADBE Effect Parade").addProperty("ADBE Ramp");
    e.property(1).setValue(p1); e.property(2).setValue(hex4(c1));
    e.property(3).setValue(p2); e.property(4).setValue(hex4(c2));
    if (radial) e.property(5).setValue(2);
    return e;
  }
  function sky(c, top, bottom) { var l = solid(c, "Sky", top || C.sky1); ramp(l, [c.width / 2, 0], top || C.sky1, [c.width / 2, c.height], bottom || C.sky3); return l; }
  function shadow(l, op, dist, soft, col) {
    var e = l.property("ADBE Effect Parade").addProperty("ADBE Drop Shadow");
    e.property(1).setValue(hex4(col || C.ink));
    var p = e.property(2); var mx = p.hasMax ? p.maxValue : 100; p.setValue(op / 100 * mx);
    e.property(3).setValue(160); e.property(4).setValue(dist); e.property(5).setValue(soft);
    return e;
  }
  function blur(l, amt) { l.property("ADBE Effect Parade").addProperty("ADBE Gaussian Blur 2").property(1).setValue(amt); }

  // shape layers. Groups are moved to index 1 when done, so later groups draw on top (painter's order).
  function shp(c, name, x, y) { var l = c.layers.addShape(); l.name = name; l.transform.position.setValue([x, y]); return l; }
  function grp(l, name) { var g = l.property("ADBE Root Vectors Group").addProperty("ADBE Vector Group"); g.name = name; return g; }
  function gAdd(g, m) { return g.property("ADBE Vectors Group").addProperty(m); }
  function gFill(g, col, op) { var f = gAdd(g, "ADBE Vector Graphic - Fill"); f.property("ADBE Vector Fill Color").setValue(hex4(col)); if (op != null) f.property("ADBE Vector Fill Opacity").setValue(op); }
  function gStroke(g, col, w, op) { var s = gAdd(g, "ADBE Vector Graphic - Stroke"); s.property("ADBE Vector Stroke Color").setValue(hex4(col)); s.property("ADBE Vector Stroke Width").setValue(w); if (op != null) s.property("ADBE Vector Stroke Opacity").setValue(op); }
  function gXf(g, x, y, rot, sc) {
    var t = g.property("ADBE Vector Transform Group");
    t.property("ADBE Vector Position").setValue([x || 0, y || 0]);
    if (rot) t.property("ADBE Vector Rotation").setValue(rot);
    if (sc) t.property("ADBE Vector Scale").setValue([sc, sc]);
  }
  function paint(g, fill, stroke, sw, op) { if (fill) gFill(g, fill, op); if (stroke) gStroke(g, stroke, sw || 4); }
  function finish(g) { g.moveTo(1); }
  function rectG(l, name, w, h, r, x, y, fill, stroke, sw, op, rot) {
    var g = grp(l, name); var p = gAdd(g, "ADBE Vector Shape - Rect");
    p.property("ADBE Vector Rect Size").setValue([w, h]); p.property("ADBE Vector Rect Roundness").setValue(r || 0);
    paint(g, fill, stroke, sw, op); gXf(g, x, y, rot); finish(g);
  }
  function ellG(l, name, w, h, x, y, fill, stroke, sw, op) {
    var g = grp(l, name); var p = gAdd(g, "ADBE Vector Shape - Ellipse");
    p.property("ADBE Vector Ellipse Size").setValue([w, h]);
    paint(g, fill, stroke, sw, op); gXf(g, x, y); finish(g);
  }
  function starG(l, name, type, pts, outer, inner, x, y, fill, stroke, sw, op, rot) {
    var g = grp(l, name); var p = gAdd(g, "ADBE Vector Shape - Star");
    p.property("ADBE Vector Star Type").setValue(type); p.property("ADBE Vector Star Points").setValue(pts);
    p.property("ADBE Vector Star Outer Radius").setValue(outer);
    if (type == 1) p.property("ADBE Vector Star Inner Radius").setValue(inner);
    paint(g, fill, stroke, sw, op); gXf(g, x, y, rot); finish(g);
  }
  function pathG(l, name, verts, inT, outT, x, y, fill, stroke, sw, op) {
    var g = grp(l, name); var p = gAdd(g, "ADBE Vector Shape - Group");
    var s = new Shape(); s.vertices = verts; if (inT) s.inTangents = inT; if (outT) s.outTangents = outT; s.closed = true;
    p.property("ADBE Vector Shape").setValue(s);
    paint(g, fill, stroke, sw, op); gXf(g, x, y); finish(g);
  }

  // text: anchor at the visual centre ("c") or left-middle ("l"), so pops scale nicely
  function txt(c, s, o) {
    var l = c.layers.addText(s);
    var p = l.property("ADBE Text Properties").property("ADBE Text Document");
    var td = p.value;
    try { td.resetCharStyle(); td.resetParagraphStyle(); } catch (e) {}
    td.font = o.font || F.bold; td.fontSize = o.size || 40;
    td.applyFill = true; td.fillColor = hex(o.color || C.ink);
    td.justification = o.just == "l" ? ParagraphJustification.LEFT_JUSTIFY : ParagraphJustification.CENTER_JUSTIFY;
    if (o.track != null) td.tracking = o.track;
    if (o.lead) { td.autoLeading = false; td.leading = o.lead; }
    if (o.stroke) { td.applyStroke = true; td.strokeColor = hex(o.stroke); td.strokeWidth = o.sw || 6; td.strokeOverFill = false; } else td.applyStroke = false;
    p.setValue(td);
    l.name = o.name || s.replace(/\r/g, " ").substr(0, 30);
    var r = l.sourceRectAtTime(0, false);
    l.transform.anchorPoint.setValue(o.just == "l" ? [r.left, r.top + r.height / 2] : [r.left + r.width / 2, r.top + r.height / 2]);
    l.transform.position.setValue([o.x || 0, o.y || 0]);
    return l;
  }
  function textWidth(l) { return l.sourceRectAtTime(0, false).width; }

  // pill: rounded rect with centred text, text parented to it. Returns { layer, w }
  function pill(c, s, o) {
    var t = txt(c, s, { font: o.font || F.bold, size: o.size || 24, color: o.fg || C.white, track: o.track, name: s });
    var w = (o.w || (textWidth(t) + 2 * (o.padX || 24))), h = o.h || Math.round((o.size || 24) * 1.9);
    var x = o.left != null ? o.left + w / 2 : o.x;
    var b = shp(c, s + " (pill)", x, o.y);
    rectG(b, "bg", w, h, h / 2, 0, 0, o.bg || C.violet, o.stroke, o.sw);
    b.moveAfter(t);
    t.parent = b; t.transform.position.setValue([0, 0]);
    if (o.rot) b.transform.rotation.setValue(o.rot);
    return { layer: b, w: w, text: t };
  }

  function footage(c, item, x, y, w, h, name) {
    var l = c.layers.add(item); l.name = name || item.name;
    var s = Math.max(w / item.width, h / item.height) * 100;
    l.transform.scale.setValue([s, s]); l.transform.position.setValue([x, y]);
    return l;
  }
  function setMatte(l, m) {
    m.moveBefore(l);
    try { l.setTrackMatte(m, TrackMatteType.ALPHA); } catch (e) { l.trackMatteType = TrackMatteType.ALPHA; }
    m.enabled = false;
  }
  function roundedFootage(c, item, x, y, w, h, r, name) {
    var l = footage(c, item, x, y, w, h, name);
    var m = shp(c, (name || item.name) + " matte", x, y); rectG(m, "m", w, h, r, 0, 0, C.white);
    setMatte(l, m);
    return l;
  }
  function avatar(c, item, x, y, sc, start) {
    var l = c.layers.add(item); l.name = item.name;
    l.transform.anchorPoint.setValue(AV_ANCHOR); l.transform.position.setValue([x, y]); l.transform.scale.setValue([sc, sc]);
    if (start) l.startTime = start;
    return l;
  }

  // ---------------- expressions ----------------
  function posExpr(o) {
    var s = "var r=value;";
    if (o.slide) s += "var t=time-inPoint-(" + o.slide[2] + ");var k=t<=0?0:1-Math.exp(-6*t)*Math.cos(8*t);r=add(r,mul([" + o.slide[0] + "," + o.slide[1] + "],1-k));";
    if (o.flt) s += "r=add(r,[Math.cos(time*" + (o.flt[1] * 0.7).toFixed(3) + "+" + o.flt[2] + ")*" + (o.flt[0] * 0.4).toFixed(2) + ",Math.sin(time*" + o.flt[1] + "+" + o.flt[2] + ")*" + o.flt[0] + "]);";
    if (o.exit) s += "var e=ease(time," + o.exit[2] + "," + (o.exit[2] + (o.exit[3] || 0.45)) + ",0,1);r=add(r,mul([" + o.exit[0] + "," + o.exit[1] + "],e*e));";
    return s + "r";
  }
  function scaleExpr(o) {
    var s = "var m=1;";
    if (o.pop != null) s += "var t=time-inPoint-(" + o.pop + ");m*=t<=0?0:(1-Math.exp(-7*t)*Math.cos(15*t));";
    if (o.exit) s += "m*=1-ease(time," + o.exit[0] + "," + (o.exit[0] + (o.exit[1] || 0.3)) + ",0,1);";
    if (o.pulse) s += "m*=1+Math.sin(time*" + o.pulse[1] + ")*" + o.pulse[0] + ";";
    return s + "[value[0]*m,value[1]*m]";
  }
  function fadeExpr(din, dout) {
    var s = "var a=100;";
    if (din != null) s += "a=Math.min(a,linear(time-inPoint," + din + "," + (din + 0.3) + ",0,100));";
    if (dout != null) s += "a=Math.min(a,linear(time," + dout + "," + (dout + 0.3) + ",100,0));";
    return s + "a*value/100";
  }
  function anim(l, o) {
    if (o.slide || o.flt || o.exit) l.transform.position.expression = posExpr(o);
    if (o.pop != null || o.scaleExit || o.pulse) l.transform.scale.expression = scaleExpr({ pop: o.pop, exit: o.scaleExit, pulse: o.pulse });
    if (o.fadeIn != null || o.fadeOut != null) l.transform.opacity.expression = fadeExpr(o.fadeIn, o.fadeOut);
    if (o.wobble) l.transform.rotation.expression = "value+Math.sin(time*" + o.wobble[1] + "+" + (o.wobble[2] || 0) + ")*" + o.wobble[0];
    return l;
  }

  // ------------------------------------------------------------------ world pieces
  function sunLayer(c, x, y, sc) {
    var rays = shp(c, "Sun rays", x, y);
    starG(rays, "rays", 1, 14, 330, 175, 0, 0, "FFE9A3", null, 0, 60);
    rays.transform.rotation.expression = "time*8";
    rays.transform.scale.setValue([sc * 100, sc * 100]);
    var d = shp(c, "Sun", x, y);
    ellG(d, "glow", 380, 380, 0, 0, "FFF3C4", null, 0, 50);
    ellG(d, "disc", 300, 300, 0, 0, "FFDB6E");
    ellG(d, "core", 230, 230, -10, -12, "FFE79A");
    d.transform.scale.setValue([sc * 100, sc * 100]);
    d.transform.scale.expression = "var m=1+Math.sin(time*1.5)*0.02;[value[0]*m,value[1]*m]";
  }
  function cloud(c, x, y, sc, drift, op) {
    var l = shp(c, "Cloud", x, y);
    ellG(l, "shade", 400, 90, 0, 48, "DDE3FF", null, 0, 70);
    ellG(l, "a", 270, 150, 0, 0, C.white);
    ellG(l, "b", 190, 115, -130, 25, C.white);
    ellG(l, "c", 210, 125, 130, 22, C.white);
    ellG(l, "d", 180, 150, -55, -52, C.white);
    ellG(l, "e", 190, 160, 62, -62, C.white);
    l.transform.scale.setValue([sc * 100, sc * 100]);
    l.transform.opacity.setValue(op || 92);
    l.transform.position.expression = "[(value[0]+time*" + drift + "+400)%2720-400,value[1]+Math.sin(time*0.5+" + x + ")*6]";
    return l;
  }
  function qBlock(c, x, y, sc) {
    var l = shp(c, "? Block", x, y);
    rectG(l, "box", 140, 140, 18, 0, 0, C.gold, C.goldD, 8);
    var k = [[-48, -48], [48, -48], [-48, 48], [48, 48]];
    for (var i = 0; i < 4; i++) rectG(l, "rivet", 12, 12, 2, k[i][0], k[i][1], C.goldD);
    var t = txt(c, "?", { font: F.display, size: 104, color: C.white, stroke: C.goldD, sw: 6 });
    t.parent = l; t.transform.position.setValue([0, 4]);
    t.transform.opacity.expression = "thisLayer.parent.transform.opacity";
    l.transform.scale.setValue([sc * 100, sc * 100]);
    return l;
  }
  function grassBlock(c, x, y, sc) {
    var l = shp(c, "Grass Block", x, y);
    rectG(l, "dirt", 140, 140, 6, 0, 0, C.brown, C.brownD, 6);
    rectG(l, "pix1", 20, 20, 0, -30, 20, C.brownD); rectG(l, "pix2", 20, 20, 0, 30, 45, C.brownD); rectG(l, "pix3", 20, 20, 0, 40, 0, "B07B50");
    rectG(l, "top", 140, 46, 6, 0, -47, "5DBB4C");
    rectG(l, "drip1", 20, 22, 0, -45, -16, "5DBB4C"); rectG(l, "drip2", 20, 16, 0, 5, -19, "5DBB4C"); rectG(l, "drip3", 20, 26, 0, 45, -14, "4FA33F");
    l.transform.scale.setValue([sc * 100, sc * 100]);
    return l;
  }
  function mushroom(c, x, y, sc) {
    var l = shp(c, "Mushroom", x, y);
    rectG(l, "stem", 104, 86, 34, 0, 34, "FFF1DF", "E7D3BD", 4);
    ellG(l, "eyeL", 13, 26, -18, 34, C.ink); ellG(l, "eyeR", 13, 26, 18, 34, C.ink);
    pathG(l, "cap", [[-95, 0], [0, -92], [95, 0]], [[0, 0], [-52, 0], [0, -50]], [[0, -50], [52, 0], [0, 0]], 0, 0, C.red, C.redD, 5);
    ellG(l, "dot1", 40, 30, -45, -35, C.white); ellG(l, "dot2", 30, 26, 30, -62, C.white); ellG(l, "dot3", 26, 22, 62, -22, C.white);
    l.transform.scale.setValue([sc * 100, sc * 100]);
    return l;
  }
  function controller(c, x, y, sc) {
    var l = shp(c, "Controller", x, y);
    ellG(l, "gripL", 92, 118, -88, 36, "5A3FE0"); ellG(l, "gripR", 92, 118, 88, 36, "5A3FE0");
    rectG(l, "body", 250, 104, 52, 0, 0, "6C4DFF");
    rectG(l, "dpadH", 46, 14, 4, -72, 0, C.white); rectG(l, "dpadV", 14, 46, 4, -72, 0, C.white);
    ellG(l, "b1", 22, 22, 62, -14, C.gold); ellG(l, "b2", 22, 22, 88, 10, C.pink); ellG(l, "b3", 22, 22, 36, 10, C.mint);
    l.transform.scale.setValue([sc * 100, sc * 100]);
    return l;
  }
  function coin(c, x, y, sc) {
    var l = shp(c, "Coin", x, y);
    ellG(l, "coin", 92, 92, 0, 0, C.gold, C.goldD, 6);
    ellG(l, "rim", 58, 58, 0, 0, null, "FFE08A", 5);
    rectG(l, "mark", 12, 34, 4, 0, 0, "FFE08A");
    l.transform.scale.setValue([sc * 100, sc * 100]);
    l.transform.scale.expression = "[value[0]*Math.cos(time*3+" + x + "),value[1]]";
    return l;
  }
  function sparkle(c, x, y, sc, col, delay) {
    var l = shp(c, "Sparkle", x, y);
    starG(l, "s", 1, 4, 34, 8, 0, 0, col || C.white);
    l.transform.scale.setValue([sc * 100, sc * 100]);
    l.transform.scale.expression = "var k=Math.max(0,Math.sin(time*3+" + (delay || 0) + "));[value[0]*k,value[1]*k]";
    l.transform.rotation.expression = "time*40";
    return l;
  }
  function hexLogo(c, x, y, sc) {
    var l = shp(c, "EH logo", x, y);
    starG(l, "glow", 2, 6, 92, 0, 0, 0, C.mint, null, 0, 35, 30);
    starG(l, "hex", 2, 6, 74, 0, 0, 0, C.violet, C.mint, 8, null, 30);
    var t = txt(c, "EH", { font: F.display, size: 58, color: C.white });
    t.parent = l; t.transform.position.setValue([0, 2]);
    t.transform.opacity.expression = "thisLayer.parent.transform.opacity";
    l.transform.scale.setValue([sc * 100, sc * 100]);
    return l;
  }
  function floatAll(list, amp) { for (var i = 0; i < list.length; i++) anim(list[i], { flt: [amp || 14, 1.2 + i * 0.13, i * 1.7], wobble: [4, 1 + i * 0.2, i] }); }

  // petals: one comp reused by every scene
  function buildPetals() {
    var c = comp("Petals", W, H, TOTAL, "Parts");
    var cols = ["FFB3D1", "FF9DC4", "FFC8DE", "FFA8CF", "F78BB8", "FFE0EC"];
    for (var i = 0; i < 46; i++) {
      var l = shp(c, "Petal " + (i + 1), 0, 0);
      pathG(l, "petal", [[0, -15], [11, 0], [0, 15], [-11, 0]], [[-7, 0], [0, -9], [7, 0], [0, 9]], [[7, 0], [0, 9], [-7, 0], [0, -9]], 0, 0, cols[i % cols.length]);
      l.transform.position.expression = "seedRandom(index*7+3,true);var sp=random(60,140),x0=random(0,2100),y0=random(0,1300),sw=random(30,90),f=random(0.5,1.3),ph=random(0,6.28),dr=random(15,45);[(x0+time*dr+Math.sin(time*f+ph)*sw)%2100-90,(y0+time*sp)%1300-110]";
      l.transform.rotation.expression = "seedRandom(index*7+3,true);random(0,360)+time*random(-120,120)";
      l.transform.scale.expression = "seedRandom(index*7+3,true);var s=random(55,120);[s,s*(0.3+0.7*Math.abs(Math.cos(time*random(1,2.4)+random(0,6))))]";
    }
    return c;
  }

  function tree(c, x, y, sc, name) {
    var l = shp(c, name || "Blossom tree", x, y);
    pathG(l, "trunk", [[-16, 0], [16, 0], [10, -170], [44, -230], [30, -238], [0, -190], [-26, -250], [-40, -240], [-10, -170]], null, null, 0, 0, C.trunk);
    var blobs = [[-70, -260, 170, "FFB3D1"], [60, -280, 180, "FF9DC4"], [-10, -340, 190, "FFC8DE"], [-110, -320, 130, "F78BB8"], [100, -350, 140, "FFB3D1"], [20, -250, 150, "FFA8CF"]];
    for (var i = 0; i < blobs.length; i++) ellG(l, "bloom", blobs[i][2], blobs[i][2] * 0.92, blobs[i][0], blobs[i][1], blobs[i][3]);
    ellG(l, "shine", 70, 50, -40, -380, "FFE0EC", null, 0, 80);
    l.transform.scale.setValue([sc * 100, sc * 100]);
    l.transform.rotation.expression = "Math.sin(time*1.1+" + x + ")*2";
    return l;
  }
  function windmill(c, x, y, sc) {
    var base = shp(c, "Windmill", x, y);
    pathG(base, "tower", [[-44, 0], [44, 0], [30, -180], [-30, -180]], null, null, 0, 0, C.cream, "E3D6C6", 4);
    pathG(base, "roof", [[-42, -176], [42, -176], [0, -232]], null, null, 0, 0, C.pink, "E05595", 4);
    rectG(base, "door", 26, 44, 10, 0, -22, "8C6A5C");
    ellG(base, "window", 22, 22, 0, -110, "8EC9F0", C.white, 3);
    base.transform.scale.setValue([sc * 100, sc * 100]);
    var bl = shp(c, "Windmill blades", 0, 0);
    for (var i = 0; i < 4; i++) {
      var g = grp(bl, "blade" + i); var p = gAdd(g, "ADBE Vector Shape - Rect");
      p.property("ADBE Vector Rect Size").setValue([30, 130]); p.property("ADBE Vector Rect Position").setValue([0, -78]);
      gFill(g, C.white); gStroke(g, "CBB8F5", 4);
      gXf(g, 0, 0, i * 90); finish(g);
    }
    ellG(bl, "hub", 26, 26, 0, 0, C.violet);
    bl.parent = base; bl.transform.position.setValue([0, -192]);
    bl.transform.rotation.expression = "-time*70";
    return base;
  }

  function buildIsland() {
    var c = comp("Floating Island", 1600, 900, TOTAL, "Parts");
    var u = shp(c, "Underside", 800, 470);
    pathG(u, "rock", [[-640, 0], [640, 0], [430, 170], [170, 330], [-90, 300], [-400, 190]], null, null, 0, 0, C.lav);
    pathG(u, "facet", [[0, 0], [640, 0], [430, 170], [170, 330]], null, null, 0, 0, C.lavD, null, 0, 70);
    pathG(u, "facet2", [[-640, 0], [-200, 0], [-90, 300], [-400, 190]], null, null, 0, 0, "C9B8F8", null, 0, 70);
    var top = shp(c, "Island top", 800, 0);
    ellG(top, "side", 1320, 360, 0, 462, C.grassD);
    ellG(top, "top", 1300, 330, 0, 438, C.grass);
    ellG(top, "patch1", 300, 80, -330, 470, C.grassL, null, 0, 80);
    ellG(top, "patch2", 260, 60, 250, 380, C.grassL, null, 0, 80);
    ellG(top, "pond", 300, 92, 360, 455, "8EC9F0", "CFE9FF", 6);
    var pal = ["FFB3D1", "B3A6FF", "FFE08A", C.white, "9FE6D6"];
    var pts = [[-520, 440], [-430, 500], [-300, 410], [-180, 520], [-60, 400], [90, 530], [180, 410], [260, 520], [470, 400], [520, 500], [-250, 470], [120, 470], [-560, 470], [560, 440], [-120, 560], [40, 330], [-360, 360], [330, 350]];
    for (var i = 0; i < pts.length; i++) ellG(top, "pebble", 20, 16, pts[i][0], pts[i][1], pal[i % pal.length]);
    ellG(top, "platform", 380, 110, 0, 470, "F3F0FF", "C9B8FF", 8);
    ellG(top, "ring", 260, 72, 0, 470, null, C.gold, 6);
    tree(c, 330, 430, 0.95, "Tree left");
    tree(c, 1330, 410, 0.7, "Tree right");
    windmill(c, 1080, 400, 0.95);
    var lamps = [[560, 520], [1040, 540]];
    for (var j = 0; j < lamps.length; j++) {
      var lp = shp(c, "Lamp", lamps[j][0], lamps[j][1]);
      rectG(lp, "post", 16, 190, 8, 0, -95, "3D3566");
      ellG(lp, "halo", 92, 92, 0, -200, "FFF6A8", null, 0, 35);
      ellG(lp, "bulb", 50, 50, 0, -200, "FFF6A8");
      lp.transform.opacity.setValue(100);
    }
    return c;
  }

  // ------------------------------------------------------------------ cards (precomps)
  function questCard(p, i, item) {
    var c = comp("Quest card - " + p.title, 680, 720, SCENES[4][2], "Parts/Quest cards");
    var bg = shp(c, "Card", 340, 360); rectG(bg, "bg", 680, 720, 36, 0, 0, C.white, "E3DBFF", 4, 96);
    roundedFootage(c, item, 340, 200, 640, 360, 24, "Image");
    pill(c, p.cat, { left: 40, y: 54, size: 20, bg: C.white, fg: C.ink, h: 40, padX: 16 });
    txt(c, p.title, { font: F.display, size: 40, color: C.ink, just: "l", x: 30, y: 432 });
    txt(c, p.sub, { font: F.bold, size: 26, color: C.violet, just: "l", x: 32, y: 480 });
    var rcol = p.kind == "reward" ? [C.goldL, "B86A00"] : p.kind == "status" ? ["DDF8F1", "0E8F78"] : ["EEEAFF", C.violetD];
    var rp = pill(c, p.line, { left: 32, y: 545, size: 24, bg: rcol[0], fg: rcol[1], h: 50, padX: 22 });
    var x = 32;
    for (var k = 0; k < p.tags.length; k++) { var tg = pill(c, p.tags[k], { left: x, y: 640, size: 20, bg: "F2F0FA", fg: C.ink2, h: 42, padX: 16 }); x += tg.w + 10; }
    var ts = 1.35 + 2 * i;
    var st = pill(c, "QUEST COMPLETE", { x: 500, y: 330, size: 26, font: F.display, bg: C.white, fg: "0E8F78", stroke: C.mint, sw: 5, h: 58, padX: 22, rot: -9 });
    st.layer.transform.scale.expression = "var t=time-" + ts + ";var s=t<0?0:(t<0.12?linear(t,0,0.12,260,95):100-6*Math.exp(-10*(t-0.12))*Math.cos(30*(t-0.12)));[s,s]";
    shadow(st.layer, 30, 6, 12);
    return c;
  }
  function photoCard() {
    var c = comp("Player card", 600, 800, SCENES[1][2], "Parts");
    var bg = shp(c, "Frame", 300, 400); rectG(bg, "bg", 600, 800, 40, 0, 0, C.white);
    var ph = roundedFootage(c, imp("photos/ebad.jpg"), 300, 400, 556, 756, 28, "Ebad photo");
    var tag = pill(c, "PLAYER 1", { left: 40, y: 64, size: 26, font: F.display, bg: C.violet, fg: C.white, h: 52, padX: 22 });
    shadow(tag.layer, 35, 4, 10);
    var lv = pill(c, "LV 4  -  4TH YEAR", { x: 300, y: 730, size: 24, font: F.hud, bg: C.ink, fg: C.gold, h: 50, padX: 22, track: 60 });
    sparkle(c, 520, 120, 0.9, C.gold, 0); sparkle(c, 80, 640, 0.7, C.white, 2);
    return c;
  }
  function screenComp() {
    var c = comp("Island screen (day to night)", 1440, 810, SCENES[2][2], "Parts");
    var day = footage(c, imp("site/home-day.png"), 720, 405, 1440, 810, "Home - day");
    day.transform.scale.expression = "var m=1+time*0.012;[value[0]*m,value[1]*m]";
    var night = footage(c, imp("site/home-night.png"), 720, 405, 1440, 810, "Home - night");
    night.transform.scale.expression = "var m=1+time*0.012;[value[0]*m,value[1]*m]";
    var m = shp(c, "Night reveal", 1035, 36);
    var g = grp(m, "circle"); var e = gAdd(g, "ADBE Vector Shape - Ellipse");
    e.property("ADBE Vector Ellipse Size").expression = "var k=ease(time,3.0,3.9,0,1);[3400*k,3400*k]";
    gFill(g, C.white); finish(g);
    setMatte(night, m);
    return c;
  }
  function monitorComp(screen) {
    var c = comp("Island monitor", 1500, 880, SCENES[2][2], "Parts");
    var b = shp(c, "Bezel", 750, 440); rectG(b, "bezel", 1500, 880, 44, 0, 0, C.ink, C.violet, 6);
    ellG(b, "cam", 12, 12, 0, -425, "3B3F73");
    var s = c.layers.add(screen); s.transform.position.setValue([750, 445]);
    var m = shp(c, "Screen matte", 750, 445); rectG(m, "m", 1440, 810, 24, 0, 0, C.white);
    setMatte(s, m);
    return c;
  }
  function polaroid(name, img, caption) {
    var c = comp(name, 1000, 700, SCENES[5][2], "Parts");
    var bg = shp(c, "Polaroid", 500, 350); rectG(bg, "bg", 1000, 700, 24, 0, 0, C.white);
    roundedFootage(c, imp(img), 500, 320, 960, 600, 14, name);
    txt(c, caption, { font: F.bold, size: 30, color: C.ink, x: 500, y: 663 });
    return c;
  }
  function featureCard(img, title, sub, col) {
    var c = comp("Power-up - " + title, 520, 820, SCENES[6][2], "Parts");
    var bg = shp(c, "Card", 260, 410); rectG(bg, "bg", 520, 820, 34, 0, 0, C.white, "E3DBFF", 4);
    roundedFootage(c, imp(img), 260, 320, 480, 600, 22, title);
    txt(c, title, { font: F.display, size: 38, color: C.ink, x: 260, y: 676 });
    txt(c, sub, { font: F.semi, size: 24, color: C.ink2, x: 260, y: 742, lead: 32 });
    var b = shp(c, "Badge", 452, 64); ellG(b, "c", 86, 86, 0, 0, col, C.white, 6);
    starG(b, "star", 1, 5, 26, 11, 0, 2, C.white);
    return c;
  }

  // ------------------------------------------------------------------ scenes
  var PETALS, ISLAND, AV = {};
  function petals(c, op) { var l = c.layers.add(PETALS); l.name = "Petals"; if (op) l.transform.opacity.setValue(op); return l; }
  function island(c, x, y, sc, delay) {
    var l = c.layers.add(ISLAND); l.name = "Floating island";
    l.transform.position.setValue([x, y]); l.transform.scale.setValue([sc, sc]);
    anim(l, { flt: [8, 0.8, 0], slide: delay != null ? [0, 600, delay] : null });
    return l;
  }
  function onIsland(c, isl, item, sc, start) {
    var a = avatar(c, item, 800, 470, sc, start);
    a.parent = isl; a.transform.position.setValue([800, 470]);
    return a;
  }

  function scene1(dur) {
    var c = comp(SCENES[0][0], W, H, dur, "Scenes");
    sky(c);
    sunLayer(c, 1650, 210, 0.75);
    cloud(c, 300, 180, 0.8, 18); cloud(c, 1200, 120, 0.6, 12, 80); cloud(c, 1700, 760, 0.9, 20);
    var isl = island(c, 960, 800, 85, 0.75);
    var av = onIsland(c, isl, AV.idle, 39);
    av.transform.scale.expression = "var b=1+Math.sin(time*2.2)*0.008;[value[0],value[1]*b]";
    floatAll([qBlock(c, 250, 380, 1), controller(c, 1660, 440, 0.8), coin(c, 380, 650, 0.8), grassBlock(c, 1730, 700, 0.75)]);
    petals(c);
    var logo = hexLogo(c, 960, 185, 1); anim(logo, { pop: 1.0, flt: [6, 1.4, 0] });
    var title = txt(c, "EBAD'S WORLD", { font: F.display, size: 150, color: C.white, stroke: C.violet, sw: 16, x: 960, y: 355, track: 20 });
    shadow(title, 45, 10, 6); anim(title, { pop: 1.25 });
    var sub = pill(c, "AN INTERACTIVE 3D PORTFOLIO", { x: 960, y: 475, size: 30, font: F.hud, bg: C.violet, fg: C.white, h: 62, padX: 30, track: 120 });
    anim(sub.layer, { pop: 1.6 });
    var ps = txt(c, "PRESS START", { font: F.display, size: 56, color: C.white, stroke: C.ink, sw: 8, x: 960, y: 1005, track: 160 });
    ps.transform.opacity.expression = "var t=time;if(t<2.1)0;else if(t<3.6)(Math.floor(t*2.5)%2==0?100:20);else (Math.floor(t*12)%2==0?100:30)";
    ps.transform.scale.expression = "var m=time>3.6?1.12:1+Math.sin(time*5)*0.02;[value[0]*m,value[1]*m]";
    // boot overlay
    var boot = solid(c, "Boot screen", C.ink); boot.transform.opacity.expression = "linear(time,0.7,0.95,100,0)";
    var lt = txt(c, "LOADING WORLD...", { font: F.hud, size: 34, color: C.white, x: 960, y: 500, track: 300 });
    lt.transform.opacity.expression = "linear(time,0.7,0.95,100,0)";
    var bar = shp(c, "Loading bar", 960, 560); rectG(bar, "track", 600, 26, 13, 0, 0, null, C.white, 3);
    bar.transform.opacity.expression = "linear(time,0.7,0.95,100,0)";
    var fill = shp(c, "Loading fill", 664, 560); rectG(fill, "fill", 592, 18, 9, 296, 0, C.mint);
    fill.transform.scale.expression = "[ease(time,0.05,0.65,0,100),100]";
    fill.transform.opacity.expression = "linear(time,0.7,0.95,100,0)";
    var flash = solid(c, "Flash", C.white); flash.transform.opacity.expression = "time<0.8?0:linear(time,0.8,0.9,0,85)-linear(time,0.9,1.3,0,85)";
    return c;
  }

  function scene2(dur) {
    var c = comp(SCENES[1][0], W, H, dur, "Scenes");
    sky(c, "7B5CFF", C.night2);
    var st = shp(c, "Stripes", 960, 540);
    for (var i = -12; i <= 12; i++) rectG(st, "s", 90, 2600, 0, i * 200, 0, C.white, null, 0, 6, 30);
    st.transform.position.expression = "[value[0]+(time*70)%200,value[1]]";
    petals(c, 55);
    var p1 = txt(c, "P1", { font: F.display, size: 620, color: C.white, x: 500, y: 560 }); p1.transform.opacity.setValue(6);
    var head = txt(c, "SELECT YOUR PLAYER", { font: F.hud, size: 44, color: C.white, x: 960, y: 150, track: 260 });
    anim(head, { slide: [0, -120, 0.15], fadeIn: 0.15 });
    var glow = shp(c, "Card glow", 500, 600); ellG(glow, "g", 760, 900, 0, 0, C.violetL, null, 0, 45); blur(glow, 90);
    var card = c.layers.add(photoCard()); card.transform.position.setValue([500, 600]);
    anim(card, { slide: [-1000, 0, 0.3], flt: [8, 1.1, 0], wobble: [1.2, 0.9, 0] }); shadow(card, 40, 18, 40);
    var X = 900;
    var n1 = txt(c, "MUHAMMAD", { font: F.display, size: 98, color: C.white, just: "l", x: X, y: 300 }); anim(n1, { slide: [120, 0, 0.6], fadeIn: 0.6 });
    var n2 = txt(c, "EBAD HAFEEZ", { font: F.display, size: 98, color: C.gold, just: "l", x: X, y: 405 }); anim(n2, { slide: [120, 0, 0.75], fadeIn: 0.75 });
    shadow(n1, 35, 6, 8); shadow(n2, 35, 6, 8);
    var cls = pill(c, "CLASS: GAME DEVELOPER", { left: X, y: 500, size: 28, font: F.hud, bg: C.mint, fg: C.ink, h: 58, padX: 26, track: 80 });
    anim(cls.layer, { pop: 1.0 });
    var info = txt(c, "Karachi, Pakistan   |   NED University, BCIT", { font: F.semi, size: 28, color: "E6E2FF", just: "l", x: X, y: 572 });
    anim(info, { fadeIn: 1.2, slide: [60, 0, 1.2] });
    var stats = [["GAME DEVELOPMENT", 95, C.mint], ["LEVEL DESIGN", 90, C.gold], ["ENVIRONMENT ART", 86, C.pink], ["WEB & BACKEND", 84, "7CC4FF"]];
    for (var s = 0; s < stats.length; s++) {
      var y = 650 + s * 66, d = 1.4 + s * 0.15;
      var lb = txt(c, stats[s][0], { font: F.hud, size: 24, color: C.white, just: "l", x: X, y: y, track: 40 }); anim(lb, { fadeIn: d });
      var tr = shp(c, "Bar track", 1215, y); rectG(tr, "t", 300, 22, 11, 150, 0, C.white, null, 0, 20); anim(tr, { fadeIn: d });
      var fl = shp(c, "Bar fill", 1215, y); rectG(fl, "f", 300, 22, 11, 150, 0, stats[s][2]);
      fl.transform.scale.expression = "[ease(time," + d + "," + (d + 0.9) + ",0," + stats[s][1] + "),100]";
    }
    var av = avatar(c, AV.wave, 1730, 1015, 55); anim(av, { fadeIn: 0.9, slide: [300, 0, 0.9] });
    var bub = pill(c, "Hi, I'm Ebad!", { x: 1760, y: 330, size: 30, font: F.display, bg: C.white, fg: C.ink, h: 64, padX: 28 });
    var tail = shp(c, "Bubble tail", 0, 0); pathG(tail, "t", [[-14, 0], [14, 0], [4, 22]], null, null, 0, 0, C.white);
    tail.parent = bub.layer; tail.transform.position.setValue([0, 31]);
    anim(bub.layer, { pop: 1.8, flt: [5, 2, 1] });
    var rd = txt(c, "READY!", { font: F.display, size: 150, color: C.gold, stroke: C.ink, sw: 14, x: 500, y: 960 });
    rd.transform.rotation.setValue(-8);
    rd.transform.scale.expression = "var t=time-5.9;var s=t<0?0:(t<0.12?linear(t,0,0.12,280,95):100-6*Math.exp(-10*(t-0.12))*Math.cos(30*(t-0.12)));[s,s]";
    shadow(rd, 45, 8, 6);
    return c;
  }

  function scene3(dur) {
    var c = comp(SCENES[2][0], W, H, dur, "Scenes");
    sky(c); sunLayer(c, 1730, 170, 0.55);
    cloud(c, 200, 220, 0.7, 15); cloud(c, 1500, 300, 0.6, 10, 85);
    floatAll([qBlock(c, 150, 420, 0.9), controller(c, 1790, 390, 0.75), coin(c, 170, 820, 0.8), mushroom(c, 1790, 830, 0.9)]);
    petals(c);
    var h = txt(c, "ENTER THE ISLAND", { font: F.display, size: 66, color: C.ink, x: 960, y: 165 }); anim(h, { pop: 0.15 });
    var sb = txt(c, "A 3D world in the browser: scroll and the camera flies to each section", { font: F.semi, size: 30, color: C.ink2, x: 960, y: 228 });
    anim(sb, { fadeIn: 0.4 });
    var mon = c.layers.add(monitorComp(screenComp())); mon.transform.position.setValue([960, 640]); mon.transform.scale.setValue([80, 80]);
    anim(mon, { pop: 0.3, flt: [5, 0.9, 0] }); shadow(mon, 35, 18, 40);
    // day / night pill
    var pb = shp(c, "Mode pill", 960, 1030); rectG(pb, "bg", 360, 62, 31, 0, 0, C.white);
    pb.property("ADBE Root Vectors Group").property(1).property("ADBE Vectors Group").property(2).property("ADBE Vector Fill Color").expression = "time<3.4?[1,0.86,0.43,1]:[0.165,0.13,0.38,1]";
    var pt = txt(c, "NIGHT MODE", { font: F.hud, size: 30, color: C.ink, track: 160 });
    pt.parent = pb; pt.transform.position.setValue([0, 0]);
    pt.property("ADBE Text Properties").property("ADBE Text Document").expression = "time<3.4?'DAY MODE':'NIGHT MODE'";
    pt.property("ADBE Effect Parade").addProperty("ADBE Fill").property(3).expression = "time<3.4?[0.086,0.094,0.227,1]:[1,1,1,1]";
    anim(pb, { pop: 0.8 });
    return c;
  }

  function scene4(dur) {
    var c = comp(SCENES[3][0], W, H, dur, "Scenes");
    sky(c, C.sky2, C.sky3);
    cloud(c, 1500, 140, 0.6, 14, 85); cloud(c, 120, 980, 0.7, 10, 80);
    petals(c, 80);
    var h = txt(c, "INVENTORY", { font: F.display, size: 76, color: C.ink, just: "l", x: 160, y: 170 }); anim(h, { slide: [-200, 0, 0.1], fadeIn: 0.1 });
    var sb = txt(c, "Two toolkits: one for building worlds, one for building products", { font: F.semi, size: 30, color: C.ink2, just: "l", x: 162, y: 238 });
    anim(sb, { fadeIn: 0.35 });
    var items = [
      ["UE", "Unreal Engine", C.violet], ["U", "Unity 3D / 2D", C.violet], ["BP", "Blueprints", C.violet], ["XR", "Meta Quest 3", C.violet],
      ["LD", "Level Design", C.mint], ["EA", "Environment Art", C.mint], ["UI", "Game UI", C.mint], ["3D", "Blender", C.pink],
      ["R", "React", C.sun], ["N", "Next.js", C.sun], ["JS", "Node.js", C.sun], ["DB", "PostgreSQL", C.sun]
    ];
    var xs = [270, 500, 730, 960], ys = [410, 640, 870];
    for (var i = 0; i < items.length; i++) {
      var x = xs[i % 4], y = ys[Math.floor(i / 4)];
      var sl = shp(c, "Slot " + items[i][1], x, y);
      rectG(sl, "slot", 200, 200, 30, 0, 0, C.white, items[i][2], 6, 92);
      ellG(sl, "icon", 92, 92, 0, -28, items[i][2]);
      var ic = txt(c, items[i][0], { font: F.display, size: 36, color: C.white }); ic.parent = sl; ic.transform.position.setValue([0, -28]);
      var nm = txt(c, items[i][1], { font: F.bold, size: 21, color: C.ink }); nm.parent = sl; nm.transform.position.setValue([0, 56]);
      anim(sl, { pop: 0.9 + 0.22 * i });
      shadow(sl, 18, 6, 14, C.violetD);
    }
    var leg = [["Game engines", C.violet], ["World building", C.mint], ["Art tools", C.pink], ["Web & backend", C.sun]];
    var lx = 170;
    for (var k = 0; k < leg.length; k++) {
      var dot = shp(c, "Legend dot", lx, 1010); ellG(dot, "d", 20, 20, 0, 0, leg[k][1]);
      var lt = txt(c, leg[k][0], { font: F.bold, size: 22, color: C.ink2, just: "l", x: lx + 18, y: 1010 });
      anim(dot, { fadeIn: 3.6 }); anim(lt, { fadeIn: 3.6 });
      lx += textWidth(lt) + 70;
    }
    var cur = shp(c, "Selector", 270, 410); rectG(cur, "c", 226, 226, 38, 0, 0, null, C.gold, 8);
    cur.transform.position.expression = "var P=[[270,410],[730,640],[960,870],[500,410],[730,870]];var t=time-3.7;if(t<0){P[0]}else{var i=Math.min(P.length-1,Math.floor(t/0.55));i==0?P[0]:ease(t-i*0.55,0,0.18,P[i-1],P[i])}";
    cur.transform.opacity.expression = "time<3.7?0:100";
    cur.transform.scale.expression = "var m=1+Math.sin(time*9)*0.03;[value[0]*m,value[1]*m]";
    // level up corner
    for (var r = 0; r < 3; r++) {
      var ring = shp(c, "Level-up ring", 1520, 1000); ellG(ring, "r", 330, 96, 0, 0, null, r == 1 ? C.violet : C.gold, 6);
      ring.transform.position.expression = "var t=(time+" + r * 0.5 + ")%3;[value[0],value[1]-t*240]";
      ring.transform.opacity.expression = "var t=(time+" + r * 0.5 + ")%3;Math.sin(Math.min(1,t/1.6)*Math.PI)*90";
    }
    var lu = avatar(c, AV.levelup, 1520, 1005, 56); anim(lu, { fadeIn: 0.4 });
    var lvl = txt(c, "LEVEL UP!", { font: F.display, size: 96, color: C.gold, stroke: C.ink, sw: 10, x: 1520, y: 250 });
    anim(lvl, { pop: 1.4, pulse: [0.03, 6] }); shadow(lvl, 40, 6, 6);
    var nw = pill(c, "NEW: Three.js  +  React Three Fiber  +  RAG chatbots", { x: 1520, y: 340, size: 24, bg: C.ink, fg: C.white, h: 54, padX: 24 });
    anim(nw.layer, { pop: 1.9 });
    return c;
  }

  var PROJECTS = [
    { id: "two-lights", title: "Two Lights One Escape", sub: "Co-op puzzle platformer", cat: "Game", kind: "reward", line: "1st place, GameCon", tags: ["Unity 3D", "Local co-op", "Level design"] },
    { id: "taleem360", title: "Taleem360", sub: "AR learning app (FYDP)", cat: "VR / XR", kind: "reward", line: "Best FYDP, Techfest 2026", tags: ["AR", "3D models", "Team FYDP"] },
    { id: "rfq-saas", title: "RFQ-to-Invoice SaaS", sub: "Aviation parts trading", cat: "Web & backend", kind: "status", line: "In pilot with early customers", tags: ["Next.js", "Supabase", "Solo"] },
    { id: "ludo-backend", title: "Ludo Mobile Game Backend", sub: "Realtime game server", cat: "Web & backend", kind: "role", line: "Backend + Unity integration", tags: ["Node.js", "PostgreSQL", "Unity"] },
    { id: "tiny-village", title: "Tiny Village", sub: "Survival horror", cat: "Game", kind: "reward", line: "Showcase: GameCon 2026", tags: ["Unreal Engine", "Environment"] },
    { id: "underwater-vr", title: "Underwater VR Experience", sub: "Ocean exploration", cat: "VR / XR", kind: "role", line: "Full ocean environment", tags: ["Meta Quest 3", "Unity VR"] }
  ];

  function scene5(dur) {
    var c = comp(SCENES[4][0], W, H, dur, "Scenes");
    sky(c); sunLayer(c, 1760, 150, 0.5);
    cloud(c, 300, 300, 0.8, 16, 85); cloud(c, 1300, 210, 0.6, 12, 80); cloud(c, 900, 980, 0.9, 10, 85);
    petals(c, 85);
    var h = txt(c, "QUEST LOG", { font: F.display, size: 76, color: C.ink, just: "l", x: 160, y: 170 }); anim(h, { slide: [-200, 0, 0.1], fadeIn: 0.1 });
    var sb = txt(c, "Games I helped build and products I shipped", { font: F.semi, size: 30, color: C.ink2, just: "l", x: 162, y: 238 });
    anim(sb, { fadeIn: 0.35 });
    var cnt = pill(c, "QUESTS COMPLETE  0 / 6", { x: 1640, y: 180, size: 28, font: F.hud, bg: C.ink, fg: C.gold, h: 62, padX: 28, track: 60 });
    cnt.text.property("ADBE Text Properties").property("ADBE Text Document").expression = "'QUESTS COMPLETE  '+Math.max(0,Math.min(6,Math.floor((time-1.35)/2)+1))+' / 6'";
    anim(cnt.layer, { pop: 0.4 });
    var track = c.layers.addNull(dur); track.name = "Quest track"; track.transform.position.setValue([960, 615]);
    track.transform.position.expression = "var SP=780,x;if(time<1){x=ease(time,0.1,1,960+2*SP,960)}else{var i=Math.min(5,Math.floor((time-1)/2));var l=time-1-2*i;x=(i<5&&l>1.3)?ease(l,1.3,2,960-i*SP,960-(i+1)*SP):960-i*SP};[x,value[1]]";
    for (var i = 0; i < PROJECTS.length; i++) {
      var p = PROJECTS[i];
      var item = imp("projects/" + p.id + ".jpg");
      var cl = c.layers.add(questCard(p, i, item));
      cl.parent = track; cl.transform.position.setValue([i * 780, 0]);
      cl.transform.scale.expression = "var d=Math.abs(toComp(anchorPoint)[0]-960);var s=linear(d,0,780,100,74);[s,s]";
      cl.transform.opacity.expression = "var d=Math.abs(toComp(anchorPoint)[0]-960);linear(d,500,1500,100,35)";
      shadow(cl, 28, 16, 36, C.violetD);
    }
    return c;
  }

  function toast(c, y, w, line1, line2, tIn, tOut) {
    var tb = shp(c, "Achievement toast - " + line2, 960, y);
    var lx = -w / 2 + 62;
    rectG(tb, "bg", w, 124, 62, 0, 0, C.ink, C.gold, 5);
    ellG(tb, "trophy bg", 96, 96, lx, 0, C.gold);
    pathG(tb, "cup", [[lx - 22, -26], [lx + 22, -26], [lx + 16, 4], [lx, 12], [lx - 16, 4]], null, null, 0, 0, C.white);
    rectG(tb, "stem", 8, 14, 0, lx, 18, C.white); rectG(tb, "base", 30, 8, 3, lx, 28, C.white);
    var t1 = txt(c, line1, { font: F.hud, size: 28, color: C.gold, just: "l", track: 200 }); t1.parent = tb; t1.transform.position.setValue([lx + 70, -22]);
    var t2 = txt(c, line2, { font: F.display, size: 38, color: C.white, just: "l" }); t2.parent = tb; t2.transform.position.setValue([lx + 70, 22]);
    anim(tb, { slide: [0, -280, tIn], exit: tOut != null ? [0, -320, tOut, 0.4] : null }); shadow(tb, 40, 8, 20, C.night1);
    return tb;
  }
  function confetti(c, dur, burst, x, y) {
    var cf = comp("Confetti " + burst, W, H, dur, "Parts");
    var cols = [C.gold, C.pink, C.mint, C.violetL, "7CC4FF", C.white];
    for (var k = 0; k < 70; k++) {
      var l = shp(cf, "Confetto " + (k + 1), 0, 0); rectG(l, "c", 14, 24, 3, 0, 0, cols[k % cols.length]);
      l.transform.position.expression = "seedRandom(index+" + Math.round(burst * 10) + ",true);var t=time-" + burst + ";var vx=random(-1100,1100),vy=random(-1400,-450);t<0?[-500,-500]:[" + x + "+vx*(1-Math.exp(-1.6*t))/1.6," + y + "+vy*(1-Math.exp(-1.6*t))/1.6+520*t*t]";
      l.transform.rotation.expression = "seedRandom(index,true);time*random(-720,720)";
      l.transform.scale.expression = "seedRandom(index,true);[100,100*Math.cos(time*random(4,9))]";
      l.transform.opacity.expression = "linear(time," + (burst + 2.7) + "," + (burst + 3.7) + ",100,0)";
    }
    c.layers.add(cf);
  }

  function scene6(dur) {
    var c = comp(SCENES[5][0], W, H, dur, "Scenes");
    var bg = solid(c, "Night stage", C.night2); ramp(bg, [800, 560], "3A2C86", [800, 1500], C.night1, true);
    var rays = shp(c, "Light rays", 800, 580); starG(rays, "rays", 1, 18, 1700, 90, 0, 0, C.gold, null, 0, 10);
    rays.transform.rotation.expression = "time*6";
    petals(c, 70);
    var spot = shp(c, "Spotlight", 1600, 760); ellG(spot, "s", 520, 760, 0, 0, C.violetL, null, 0, 30); blur(spot, 80);
    var glow = shp(c, "Photo glow", 800, 615); ellG(glow, "g", 980, 720, 0, 0, C.gold, null, 0, 40); blur(glow, 100);
    anim(glow, { pop: 0.9 });
    // 1) Best FYDP (Taleem360)
    var ph = c.layers.add(polaroid("FYDP award photo", "photos/fydp-award-crop.jpg", "Team Taleem360 at Techfest 2026, NED University"));
    ph.transform.position.setValue([800, 625]); ph.transform.scale.setValue([82, 82]); ph.transform.rotation.setValue(-2);
    anim(ph, { pop: 0.9, flt: [6, 1, 0], exit: [-1500, 60, 4.0, 0.5] }); shadow(ph, 45, 18, 40, C.night1);
    confetti(c, dur, 0.9, 800, 560);
    toast(c, 178, 900, "ACHIEVEMENT UNLOCKED", "Best FYDP  -  Techfest 2026", 0.35, 4.0);
    // 2) Two Lights One Escape: 1st place at GameCon and in the departmental evaluation
    var ph2 = c.layers.add(polaroid("GameCon award photo", "photos/gamecon-award-crop.jpg", "Team Two Lights One Escape, NED University"));
    ph2.transform.position.setValue([800, 625]); ph2.transform.scale.setValue([82, 82]); ph2.transform.rotation.setValue(2);
    anim(ph2, { slide: [1500, 0, 4.4], flt: [6, 1.1, 2] }); shadow(ph2, 45, 18, 40, C.night1);
    ph2.transform.opacity.expression = "time<4.4?0:100";
    confetti(c, dur, 4.7, 800, 560);
    toast(c, 178, 1080, "ACHIEVEMENT UNLOCKED  x2", "1st place  -  GameCon  +  NED evaluation", 4.55, null);
    var av = avatar(c, AV.lift, 1600, 1010, 58, 0.6); anim(av, { fadeIn: 0.6 });
    var badges = [["BEST FYDP  -  TECHFEST 2026", C.gold, C.ink], ["1ST PLACE  -  GAMECON", C.mint, C.ink], ["1ST PLACE  -  NED DEPARTMENTAL EVALUATION", C.violetL, C.ink]];
    var widths = [], tmp = [];
    for (var b = 0; b < badges.length; b++) {
      var pb = pill(c, badges[b][0], { x: 0, y: 995, size: 22, font: F.hud, bg: badges[b][1], fg: badges[b][2], h: 52, padX: 22, track: 60 });
      widths.push(pb.w); tmp.push(pb.layer);
    }
    var total = widths[0] + widths[1] + widths[2] + 40, x = 800 - total / 2;
    for (var q = 0; q < 3; q++) { tmp[q].transform.position.setValue([x + widths[q] / 2, 995]); x += widths[q] + 20; anim(tmp[q], { pop: 7.0 + q * 0.3 }); }
    return c;
  }

  function scene7(dur) {
    var c = comp(SCENES[6][0], W, H, dur, "Scenes");
    sky(c); sunLayer(c, 1780, 140, 0.45);
    cloud(c, 250, 250, 0.7, 14, 85); cloud(c, 1650, 980, 0.8, 12, 85);
    petals(c, 85);
    var h = txt(c, "POWER-UPS", { font: F.display, size: 76, color: C.ink, x: 960, y: 160 }); anim(h, { pop: 0.1 });
    var sb = txt(c, "Built into the portfolio", { font: F.semi, size: 30, color: C.ink2, x: 960, y: 226 }); anim(sb, { fadeIn: 0.3 });
    var cards = [
      ["site/feature-chat.png", "ASK MY AI", "RAG chatbot that answers\rfrom my CV, in English or Urdu", C.violet],
      ["site/feature-contact.png", "SEND A MESSAGE", "Working contact form\rwith spam protection", C.mint],
      ["site/feature-night.png", "DAY & NIGHT", "One click turns the sky\rinto a starry night", C.pink]
    ];
    var xs = [520, 960, 1400], rots = [-4, 0, 4];
    for (var i = 0; i < 3; i++) {
      var l = c.layers.add(featureCard(cards[i][0], cards[i][1], cards[i][2], cards[i][3]));
      l.transform.position.setValue([xs[i], 650]); l.transform.scale.setValue([74, 74]); l.transform.rotation.setValue(rots[i]);
      anim(l, { pop: 0.6 + i * 0.8, flt: [7, 1.2 + i * 0.2, i] }); shadow(l, 30, 16, 36, C.violetD);
      var sp = sparkle(c, xs[i] + 170, 330, 1, C.gold, i * 2);
    }
    return c;
  }

  function scene8(dur) {
    var c = comp(SCENES[7][0], W, H, dur, "Scenes");
    sky(c); sunLayer(c, 1650, 200, 0.7);
    cloud(c, 280, 170, 0.8, 16); cloud(c, 1250, 110, 0.6, 12, 80);
    var isl = island(c, 960, 860, 95);
    var av = onIsland(c, isl, AV.peace, 38);
    floatAll([qBlock(c, 230, 430, 0.95), grassBlock(c, 1690, 470, 0.85), coin(c, 380, 680, 0.8), mushroom(c, 1600, 700, 0.6)]);
    petals(c);
    var t = txt(c, "THANKS FOR PLAYING!", { font: F.display, size: 124, color: C.white, stroke: C.violet, sw: 14, x: 960, y: 245, track: 10 });
    shadow(t, 45, 10, 6); anim(t, { pop: 0.3 });
    var sb = pill(c, "Scroll on to explore the portfolio  +  ask my AI anything", { x: 960, y: 365, size: 30, bg: C.violet, fg: C.white, h: 66, padX: 32 });
    anim(sb.layer, { pop: 0.8 });
    // closing iris and end card
    var iris = shp(c, "End iris", 960, 540);
    var g = grp(iris, "circle"); var e = gAdd(g, "ADBE Vector Shape - Ellipse");
    e.property("ADBE Vector Ellipse Size").expression = "var k=ease(time,5.0,5.5,0,1);[2400*k,2400*k]";
    gFill(g, C.violet); finish(g);
    var logo = hexLogo(c, 960, 430, 1.4); anim(logo, { pop: 5.4 });
    var nm = txt(c, "MUHAMMAD EBAD HAFEEZ", { font: F.display, size: 72, color: C.white, x: 960, y: 610, track: 40 }); anim(nm, { pop: 5.6 });
    var rl = txt(c, "Game developer  |  Karachi, Pakistan", { font: F.semi, size: 34, color: "E6E2FF", x: 960, y: 690 }); anim(rl, { fadeIn: 5.8 });
    return c;
  }

  // ------------------------------------------------------------------ main comp
  function hud(c) {
    var t0 = SCENES[1][1], t1 = SCENES[7][1];
    var fade = "Math.min(linear(time," + t0 + "," + (t0 + 0.4) + ",0,100),linear(time," + (t1 - 0.4) + "," + t1 + ",100,0))";
    var starts = "[" + SCENES[1][1] + "," + SCENES[2][1] + "," + SCENES[3][1] + "," + SCENES[4][1] + "," + SCENES[5][1] + "," + SCENES[6][1] + "]";
    var prog = "var S=" + starts + ";var p=0;for(var i=1;i<S.length;i++){if(time>=S[i])p=i-1+ease(time,S[i],S[i]+0.6,0,1);};";
    var bar = shp(c, "HUD bar", 960, 58); rectG(bar, "bg", 1180, 76, 38, 0, 0, C.white, null, 0, 82);
    rectG(bar, "track", 950, 8, 4, 5, 0, "DAD6F2");
    for (var i = 0; i < 6; i++) ellG(bar, "dot", 22, 22, -470 + i * 190, 0, C.white, "C9C3EE", 4);
    bar.transform.opacity.expression = fade;
    var lg = hexLogo(c, 410, 58, 0.36); lg.transform.opacity.expression = fade;
    var fl = shp(c, "HUD progress", 490, 58); var g = grp(fl, "fill"); var r = gAdd(g, "ADBE Vector Shape - Rect");
    r.property("ADBE Vector Rect Size").expression = prog + "[Math.max(1,p*190),8]";
    r.property("ADBE Vector Rect Position").expression = prog + "[p*95,0]";
    r.property("ADBE Vector Rect Roundness").setValue(4);
    gFill(g, C.violet); finish(g);
    fl.transform.opacity.expression = fade;
    var mk = shp(c, "HUD marker", 490, 58); ellG(mk, "m", 30, 30, 0, 0, C.violet, C.white, 5);
    mk.transform.position.expression = prog + "[490+p*190,value[1]]";
    mk.transform.opacity.expression = fade;
    var p1 = txt(c, "P1", { font: F.hud, size: 30, color: C.violet }); p1.transform.position.setValue([1505, 58]); p1.transform.opacity.expression = fade;
  }

  function transitions(c) {
    var cuts = [];
    for (var i = 1; i < SCENES.length; i++) cuts.push(SCENES[i][1]);
    var cs = "[" + cuts.join(",") + "]";
    function iris(name, col, win, size) {
      var l = shp(c, name, 960, 540); var g = grp(l, "circle"); var e = gAdd(g, "ADBE Vector Shape - Ellipse");
      e.property("ADBE Vector Ellipse Size").expression = "var cuts=" + cs + ";var k=0;for(var i=0;i<cuts.length;i++){var d=time-cuts[i];if(d>-" + win + "&&d<" + win + "){k=d<0?ease(d,-" + win + ",0,0,1):ease(d,0," + win + ",1,0);}};[" + size + "*k," + size + "*k]";
      gFill(g, col); finish(g);
      return l;
    }
    iris("Transition ring", C.violet, 0.36, 2350);
    iris("Transition", C.blossom, 0.3, 2300);
    var sp = shp(c, "Transition stars", 960, 540);
    var pts = [[-260, -140], [240, -200], [300, 160], [-220, 210], [0, -280], [40, 250]];
    for (var k = 0; k < pts.length; k++) starG(sp, "star", 1, 4, 34, 8, pts[k][0], pts[k][1], C.white);
    sp.transform.scale.expression = "var cuts=" + cs + ";var k=0;for(var i=0;i<cuts.length;i++){var d=Math.abs(time-cuts[i]);if(d<0.3)k=1-d/0.3;};[100*k,100*k]";
    sp.transform.rotation.expression = "time*90";
  }

  // ------------------------------------------------------------------ build
  try {
    app.beginSuppressDialogs();
    if (app.project) app.project.close(CloseOptions.DO_NOT_SAVE_CHANGES);
    app.newProject();
    try { app.project.expressionEngine = "javascript-1.0"; } catch (e) {}
    note("AE " + app.version);

    AV.idle = imp("avatar/Idle_1.png", "Assets/Avatar");
    AV.wave = impSeq("Wave", 4);
    AV.levelup = impSeq("LevelUp", 3);
    AV.lift = impSeq("LiftTrophy", 4);
    AV.peace = impSeq("PeaceJump", 6);
    var music = imp("audio/promo_music.wav", "Assets");

    PETALS = buildPetals();
    ISLAND = buildIsland();
    var builders = [scene1, scene2, scene3, scene4, scene5, scene6, scene7, scene8];
    var main = comp("00 Promo", W, H, TOTAL, "Main");
    main.parentFolder = app.project.rootFolder;
    var sceneLayers = [];
    for (var i = 0; i < SCENES.length; i++) {
      var sc = builders[i](SCENES[i][2] + 0.4);
      var l = main.layers.add(sc);
      l.startTime = SCENES[i][1];
      l.outPoint = SCENES[i][1] + SCENES[i][2];
      sceneLayers.push(l);
      note("built " + SCENES[i][0]);
    }
    hud(main);
    transitions(main);
    var ml = main.layers.add(music); ml.name = "Music + SFX (video/make_audio.py)"; ml.moveToEnd();
    main.openInViewer();
    app.project.save(new File(VIDEO.fsName + "/promo.aep"));
    note("saved " + VIDEO.fsName + "/promo.aep");
    note("OK");
  } catch (err) {
    note("ERROR line " + err.line + ": " + err.toString());
    // also visible in the Project panel, in case scripts may not write files
    try { app.project.items.addComp(("BUILD ERROR line " + err.line + ": " + err.toString()).substr(0, 250), 100, 100, 1, 1, 30); } catch (e2) {}
  }
  app.endSuppressDialogs(false);
  writeLog();
})();
