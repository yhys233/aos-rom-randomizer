const http = require('http');
const cases = [
  ['页面 GET /', { path: '/' }, 'html'],
  ['type0(不随机)', 'random_type=0&seed=1', 'zip'],
  ['type1(仅敌人)', 'random_type=1&seed=11', 'zip'],
  ['type2(仅房间)', 'random_type=2&seed=11&random_map_type=1', 'zip'],
  ['type3(全部随机)', 'random_type=3&seed=11', 'zip'],
  ['手动 房间type3+保护区', 'random_type=0&random_map=1&random_map_type=3&random_map_no_chaos=1&random_map_no_use=1&random_map_no_bossrush=1&seed=7', 'zip'],
  ['手动 敌人数值+掉落', 'random_type=0&random_enemy_hp=1&random_enemy_soul_all=1&soul_probability=1&seed=7', 'zip'],
  ['手动 怪物位置全', 'random_type=0&random_enemy=1&boss_enemy=1&magician_secret=1&enemy_boss_min=1&double_chaos=1&light_chaos=1&shortcut=1&ringchaos=1&seed=7', 'zip'],
  ['手动 装备数值', 'random_type=0&random_item_stats_atk=1&random_item_stats_def=1&attr_weapon=1&seed=7', 'zip'],
  ['手动 道具位置', 'random_type=0&random_item_weapon=1&random_item_armor=1&random_item_accessory=1&random_item_item=1&seed=7', 'zip'],
  ['手动 商店+杂项', 'random_type=0&random_shop=1&skipdialog=1&opendebug=1&main_soul_pass=1&seed=7', 'zip'],
  ['手动 数值参数', 'random_type=0&exp_multiplier=3&boss_hp_scale=0.5&soul_probability_scale=2&item_probability_scale=2&start_weapon=1&seed=7', 'zip'],
];
(async () => {
  let fail = 0;
  for (const [name, q, kind] of cases) {
    const url = kind === 'html' ? q.path : '/ajax.php?' + q;
    const r_ = await new Promise((resolve, reject) => {
      http.get('http://localhost:18688' + url, res => {
        const chunks = [];
        res.on('data', c => chunks.push(c));
        res.on('end', () => resolve({ status: res.statusCode, body: Buffer.concat(chunks) }));
      }).on('error', reject);
    });
    const ok = r_.status === 200 && (kind === 'html' ? r_.body.includes('随机化器') : r_.body.length > 1000000);
    if (!ok) fail++;
    console.log((ok ? 'OK  ' : 'FAIL') + '  ' + name + '  HTTP ' + r_.status + '  ' + (kind === 'html' ? r_.body.length + 'B' : r_.body.length + 'B'));
  }
  console.log(fail === 0 ? 'E2E ALL OK' : 'E2E ' + fail + ' 失败');
  process.exit(fail ? 1 : 0);
})();
