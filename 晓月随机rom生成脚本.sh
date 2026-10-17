#!/bin/bash

# 一般情况下，除特殊标注之外，设为1为开启，设为0为关闭

# 生成设置
gen_count=2 # 生成ROM的数量
keep_info=1 # 保留生成信息
keep_debug=0  # 保留调试信息
keep_enemy=0  # 保留敌人信息
seed=4242  # 随机种子（0=随机生成，可填任意正整数复现相同结果）

# 路径设置（所有路径均为相对路径）
tmp_path="./tmp/"  # 临时目录
rom_path="./rom/" # ROM目录
info_path="./info/" # 生成信息目录
enemy_path="./enemy/" # 敌人信息目录
debug_path="./debug/" # 调试信息目录

# 随机类型
random_enemy=0  # 随机怪物位置
random_map=0    # 随机房间位置
random_type=3   # 未知
# 怪物随机选项
boss_enemy=0    # Boss加入小怪
balore_enemy=0  # 巴洛尔加入小怪
julius_enemy=0  # 尤利乌斯加入小怪
chaos_enemy=0   # 混沌加入小怪
magician_enemy=0    # 时之法师加入小怪
magician_secret=0   # 时之试炼
enemy_boss_min=0    # 原Boss随机生成小怪
enemy_everything=0  # 万物皆为怪
double_chaos=0  # 挑战双混沌
light_chaos=0   # 混沌地图变得明亮
shortcut=0  # 存档点快捷道路
# 房间随机选项
random_map_type=1   # 房间随机类型：1=全区域房间随机，2=区域内房间随机，3=房间完全随机
teleport=0  # 快速传送功能
random_map_no_chaos=0   # 混沌不随机
random_map_no_use=0 # 未开发区域不随机
random_map_no_bossrush=0    # BossRush地图不随机
# 道具选项
random_item_weapon=0    # 武器位置
random_item_armor=0 # 防具位置
random_item_accessory=0 # 饰品位置
random_item_item=0  # 道具位置
random_item_soul=0  # 加入魂灯
random_item_stats_atk=0 # 武器攻击
random_item_stats_def=0 # 防具防御
random_soul_stats_red=0 # 红魂攻击
# 道具属性
attr_weapon=0   # 武器属性
attr_soul_red=0 # 红魂属性
# 怪物属性
random_enemy_hp=0   # HP
random_enemy_mp=0   # MP
random_enemy_exp=0  # 经验
random_enemy_atk=0  # 攻击
random_enemy_def=0  # 防御
attr_enemy=0    # 弱点和抗性
# 怪物掉落
random_enemy_soul_red=0 # 红魂
random_enemy_soul_blue=0    # 蓝魂
random_enemy_soul_yellow=0  # 黄魂
random_enemy_soul_all=0 # 魂完全随机
random_enemy_item=0 # 道具掉落
# 其他选项
soul_probability=0 # 混掉率提高
item_probability=0  # 道具掉率提高
ringchaos=0 # 获得混沌戒指
soul_start=0    # 红蓝黄魂各一个
mutil_exp=0 # 随机2~5倍经验
mainsoul=0  # 获得剧情魂
main_soul_random=0  # 古文书三魂随机
main_soul_pass=0    # 取消三魂检测
# 高级选项
skipdialog=0    # 一周目允许跳过对话
opendebug=0 # 开启Debug模式

#########################以下部分请勿修改#########################

data_raw="random_type="$random_type

# 随机种子
if [ $seed -ne 0 ]; 
then
  data_raw=$data_raw"&seed="$seed
fi

# 随机怪物位置
if [ $random_enemy -eq 1 ]; 
then
  data_raw=$data_raw"&random_enemy=1"
  # 怪物随机选项
  if [ $boss_enemy -eq 1 ]; 
  then
    data_raw=$data_raw"&boss_enemy=1"
  fi
  if [ $balore_enemy -eq 1 ];  
  then
    data_raw=$data_raw"&balore_enemy=1"
  fi
  if [ $julius_enemy -eq 1 ];  
  then
    data_raw=$data_raw"&julius_enemy=1"
  fi
  if [ $chaos_enemy -eq 1 ];
  then
    data_raw=$data_raw"&chaos_enemy=1"
  fi
  if [ $magician_enemy -eq 1 ]; 
  then
    data_raw=$data_raw"&magican_enemy=1"
  fi
  if [ $magician_secret -eq 1 ];
  then
    data_raw=$data_raw"&magican_secret=1"
  fi
  if [ $enemy_boss_min -eq 1 ];
  then
    data_raw=$data_raw"&enemy_boss_min=1"
  fi
  if [ $enemy_everything -eq 1 ];
  then
    data_raw=$data_raw"&enemy_everything=1"
  fi
  if [ $double_chaos -eq 1 ]; 
  then
    data_raw=$data_raw"&double_chaos=1"
  fi
  if [ $light_chaos -eq 1 ];
  then
    data_raw=$data_raw"&light_chaos=1"
  fi
  if [ $shortcut -eq 1 ];
  then
    data_raw=$data_raw"&shortcut=1"
  fi
fi
# 随机房间位置
if [ $random_map -eq 1 ]; 
then
  data_raw=$data_raw"&random_map=1"
  # 房间随机选项
  if [ $random_map_type -ge 1 ]&&[ $random_map_type -le 3 ]; 
  then
    data_raw=$data_raw"&random_map_type="$random_map_type
  fi
  if [ $teleport -eq 1 ];
  then
    data_raw=$data_raw"&teleport=1"
  fi
  if [ $random_map_no_chaos -eq 1 ]; 
  then
    data_raw=$data_raw"&random_map_no_chaos=1"
  fi
  if [ $random_map_no_use -eq 1 ]; 
  then
    data_raw=$data_raw"&random_map_no_use=1"
  fi
  if [ $random_map_no_bossrush -eq 1 ]; 
  then
    data_raw=$data_raw"&random_map_no_bossrush=1"
  fi
fi
# 道具选项
if [ $random_item_weapon -eq 1 ]; 
then
  data_raw=$data_raw"&random_item_weapon=1"
fi
if [ $random_item_armor -eq 1 ]; 
then
  data_raw=$data_raw"&random_item_armor=1"
fi
if [ $random_item_accessory -eq 1 ]; 
then
  data_raw=$data_raw"&random_item_accessory=1"
fi
if [ $random_item_item -eq 1 ]; 
then
  data_raw=$data_raw"&random_item_item=1"
fi
if [ $random_item_soul -eq 1 ]; 
then
  data_raw=$data_raw"&random_item_soul=1"
fi
if [ $random_item_stats_atk -eq 1 ]; 
then
  data_raw=$data_raw"&random_item_stats_atk=1"
fi
if [ $random_item_stats_def -eq 1 ]; 
then
  data_raw=$data_raw"&random_item_stats_def=1"
fi
if [ $random_soul_stats_red -eq 1 ]; 
then
  data_raw=$data_raw"&random_source_stats_red=1"
fi
# 道具属性
if [ $attr_weapon -eq 1 ]; 
then
  data_raw=$data_raw"&attr_weapon=1"
fi
if [ $attr_soul_red -eq 1 ]; 
then
  data_raw=$data_raw"&attr_soul_red=1"
fi
# 怪物属性
if [ $random_enemy_hp -eq 1 ]; 
then
  data_raw=$data_raw"&random_enemy_hp=1"
fi
if [ $random_enemy_mp -eq 1 ]; 
then
  data_raw=$data_raw"&random_enemy_mp=1"
fi
if [ $random_enemy_exp -eq 1 ]; 
then
  data_raw=$data_raw"&random_enemy_exp=1"
fi
if [ $random_enemy_atk -eq 1 ]; 
then
  data_raw=$data_raw"&random_enemy_atk=1"
fi
if [ $random_enemy_def -eq 1 ]; 
then
  data_raw=$data_raw"&random_enemy_def=1"
fi
if [ $attr_enemy -eq 1 ]; 
then
  data_raw=$data_raw"&attr_enemy=1"
fi
# 怪物掉落
if [ $random_enemy_soul_all -eq 1 ]; 
then
  data_raw=$data_raw"&random_enemy_soul_all=1"
else
  if [ $random_enemy_soul_red -eq 1 ]; 
  then
    data_raw=$data_raw"&random_enemy_soul_red=1"
  fi
  if [ $random_enemy_soul_blue -eq 1 ]; 
  then
    data_raw=$data_raw"&random_enemy_soul_blue=1"
  fi
  if [ $random_enemy_soul_yellow -eq 1 ]; 
  then
    data_raw=$data_raw"&random_enemy_soul_yellow=1"
  fi
fi
if [ $random_enemy_item -eq 1 ]; 
then
  data_raw=$data_raw"&random_enemy_item=1"
fi
# 其他选项
if [ $soul_probability -eq 1 ]; 
then
  data_raw=$data_raw"&soul_probability=1"
fi
if [ $item_probability -eq 1 ]; 
then
  data_raw=$data_raw"&item_probability=1"
fi
if [ $ringchaos -eq 1 ]; 
then
  data_raw=$data_raw"&ringchaos=1"
fi
if [ $mainsoul -eq 1 ]; 
then
  data_raw=$data_raw"&mainsoul=1"
elif [ $soul_start -eq 1 ]; 
then
  data_raw=$data_raw"&soul_start=1"
fi
if [ $mutil_exp -eq 1 ] && [ $random_enemy_exp -ne 1 ]; 
then
  data_raw=$data_raw"&mutil_exp=1"
fi
if [ $main_soul_random -eq 1 ]; 
then
  data_raw=$data_raw"&main_soul_random=1"
fi
if [ $main_soul_pass -eq 1 ]; 
then
  data_raw=$data_raw"&main_soul_pass=1"
fi
# 高级选项
if [ $skipdialog -eq 1 ]; 
then
  data_raw=$data_raw"&skipdialog=1"
fi
if [ $opendebug -eq 1 ]; 
then
  data_raw=$data_raw"&opendebug=1"
fi

script_dir=$(cd $(dirname $0);pwd)
cd $script_dir

# 服务地址（本地随机化服务）
server_url="http://localhost:18688/ajax.php"

echo "Working directory: $script_dir"
echo "POST_DATA: $data_raw"
echo "$gen_count ROM(s) need to generate."

mkdir tmp
gen=1
while [ $gen -le $gen_count ]; 
do
  dl_name="dl_"$gen".zip"
  mkdir -p ${tmp_path}out_$gen
  echo 'Downloading...'$gen'/'$gen_count
  curl -o ${tmp_path}${dl_name} "$server_url" \
    -H 'content-type: application/x-www-form-urlencoded' \
    --data-raw $data_raw \
    --compressed
  unzip -o -d ${tmp_path}out_$gen ${tmp_path}${dl_name} >/dev/null
  let gen+=1
done
mkdir $rom_path
for f in ${tmp_path}out_*/*.gba; do cp -f "$f" $rom_path; done
if [ $keep_info -eq 1 ]; 
then
  mkdir $info_path
  for f in ${tmp_path}out_*/Castlevania*.txt; do cp -f "$f" $info_path; done
fi
if [ $keep_debug -eq 1 ]; 
then
  mkdir $debug_path
  for f in ${tmp_path}out_*/Debug*.txt; do [ -f "$f" ] && cp -f "$f" $debug_path; done
fi
if [ $keep_enemy -eq 1 ]; 
then
  mkdir $enemy_path
  for f in ${tmp_path}out_*/Enemy*.txt; do [ -f "$f" ] && cp -f "$f" $enemy_path; done
fi
rm -rf $tmp_path