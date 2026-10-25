// Meu Bichinho: adotar, ver como ele está e cuidar.
import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { fail, str } from '../util.js';
import { COLORS, KINDS, RECIPES, WARDROBE, act, adopt, loadPet, view } from '../pet.js';

const r = Router();
const member = requireAuth('member');
const catalog = { kinds: KINDS, colors: COLORS, recipes: RECIPES, wardrobe: WARDROBE };

r.get('/bichinho', member, (req, res) => {
  const p = loadPet(req.actor.id);
  res.json({ pet: p ? view(p) : null, ...catalog });
});

r.post('/bichinho', member, (req, res) => {
  if (loadPet(req.actor.id)) fail(409, 'Você já tem um bichinho');
  try {
    res.json({ pet: view(adopt(req.actor.id, { kind: str(req.body.kind, 20), name: str(req.body.name, 30), color: str(req.body.color, 20) })) });
  } catch (e) { fail(400, e.message); }
});

r.post('/bichinho/acao', member, (req, res) => {
  const p = loadPet(req.actor.id);
  if (!p) fail(404, 'Adote um bichinho primeiro');
  try {
    const out = act(p, str(req.body.acao, 20), str(req.body.item, 30));
    res.json({ pet: view(out.pet), msg: out.msg, level_up: out.levelUp });
  } catch (e) { fail(400, e.message); }
});

export default r;
