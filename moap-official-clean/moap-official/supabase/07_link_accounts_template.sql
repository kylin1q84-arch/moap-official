-- 先在 Supabase Authentication > Users 创建5个账号，再把下面邮箱替换成真实邮箱。
-- 注意：这里只需要执行一次；不要把密码写在SQL里。
update public.profiles p set player_id='P001', display_name='罗海泓', role='admin'
from auth.users u where p.user_id=u.id and u.email='YOUR_ADMIN_EMAIL';

update public.profiles p set player_id='P002', display_name='陈丰', role='viewer'
from auth.users u where p.user_id=u.id and u.email='CHENFENG_EMAIL';
update public.profiles p set player_id='P003', display_name='陈毓圣', role='viewer'
from auth.users u where p.user_id=u.id and u.email='CHENYUSHENG_EMAIL';
update public.profiles p set player_id='P004', display_name='吴韬骏', role='viewer'
from auth.users u where p.user_id=u.id and u.email='WUTAOJUN_EMAIL';
update public.profiles p set player_id='P005', display_name='陈荣升', role='viewer'
from auth.users u where p.user_id=u.id and u.email='CHENRONGSHENG_EMAIL';
