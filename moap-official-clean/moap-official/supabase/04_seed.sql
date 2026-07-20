-- Generated from MOAP_Official_v10.1_LTS_Official.xlsx certified snapshot
insert into public.players(id,name,join_season,active) values
('P001','罗海泓','S1',true),
('P002','陈丰','S1',true),
('P003','陈毓圣','S1',true),
('P004','吴韬骏','S1',true),
('P005','陈荣升','S1',true)
on conflict(id) do update set name=excluded.name,active=true;
insert into public.seasons(id,name,start_date,end_date,status) values('S1','S1赛季','2024-04-03','2024-12-02','closed') on conflict(id) do nothing;
insert into public.seasons(id,name,start_date,end_date,status) values('S2','S2赛季','2025-02-12','2025-12-24','closed') on conflict(id) do nothing;
insert into public.seasons(id,name,start_date,end_date,status) values('S3','S3赛季','2026-01-04','2026-07-16','closed') on conflict(id) do nothing;
insert into public.seasons(id,name,status) values('S4','S4赛季','active') on conflict(id) do nothing;
begin;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0001','S1',1,'2024-04-03','四人局','嗨范棋牌室（万象城店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0001','P004',21,true,false),
('MSL0001','P003',1,false,false),
('MSL0001','P001',-9,false,false),
('MSL0001','P005',-13,false,false),
('MSL0001','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0002','S1',2,'2024-04-13','五人局','嗨范棋牌室（万象城店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0002','P002',22,true,false),
('MSL0002','P004',17,false,false),
('MSL0002','P001',3,false,false),
('MSL0002','P003',-7,false,false),
('MSL0002','P005',-35,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0003','S1',3,'2024-04-20','四人局','四季风享棋牌室（思北店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0003','P003',17,true,false),
('MSL0003','P001',12,false,false),
('MSL0003','P002',-12,false,false),
('MSL0003','P004',-17,false,false),
('MSL0003','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0004','S1',4,'2024-04-27','四人局','四季风享棋牌室（思北店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0004','P003',47,true,false),
('MSL0004','P001',9,false,false),
('MSL0004','P005',-15,false,false),
('MSL0004','P004',-41,false,false),
('MSL0004','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0005','S1',5,'2024-05-03','五人局','赢雀斯听棋牌室（莲花店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0005','P003',14,true,false),
('MSL0005','P005',12,false,false),
('MSL0005','P004',5,false,false),
('MSL0005','P001',-6,false,false),
('MSL0005','P002',-25,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0006','S1',6,'2024-05-16','五人局','茶话荟茶馆',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0006','P001',23,true,false),
('MSL0006','P002',18,false,false),
('MSL0006','P004',-6,false,false),
('MSL0006','P003',-12,false,false),
('MSL0006','P005',-23,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0007','S1',7,'2024-05-25','五人局','茶话荟茶馆',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0007','P004',27,true,false),
('MSL0007','P001',15,false,false),
('MSL0007','P003',-7,false,false),
('MSL0007','P005',-9,false,false),
('MSL0007','P002',-26,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0008','S1',8,'2024-05-31','四人局','阅谈共享茶室（后江店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0008','P004',51,true,false),
('MSL0008','P001',2,false,false),
('MSL0008','P003',-22,false,false),
('MSL0008','P002',-31,false,false),
('MSL0008','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0009','S1',9,'2024-06-08','五人局','阅谈共享茶室（后江店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0009','P002',55,true,false),
('MSL0009','P004',35,false,false),
('MSL0009','P003',-17,false,false),
('MSL0009','P001',-25,false,false),
('MSL0009','P005',-48,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0010','S1',10,'2024-06-22','五人局','星八茶乐会（长青路店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0010','P002',42,true,false),
('MSL0010','P001',40,false,false),
('MSL0010','P004',4,false,false),
('MSL0010','P005',4,false,false),
('MSL0010','P003',-90,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0011','S1',11,'2024-07-06','五人局','星八茶乐会（长青路店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0011','P005',34,true,false),
('MSL0011','P004',16,false,false),
('MSL0011','P001',6,false,false),
('MSL0011','P003',-15,false,false),
('MSL0011','P002',-41,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0012','S1',12,'2024-07-21','五人局','岩初茶舍',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0012','P003',32,true,false),
('MSL0012','P002',5,false,false),
('MSL0012','P005',-6,false,false),
('MSL0012','P001',-12,false,false),
('MSL0012','P004',-19,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0013','S1',13,'2024-08-09','五人局','岩初茶舍',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0013','P001',75,true,false),
('MSL0013','P004',33,false,false),
('MSL0013','P003',-29,false,false),
('MSL0013','P005',-34,false,false),
('MSL0013','P002',-45,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0014','S1',14,'2024-08-15','四人局','七囍茶室（厦门站店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0014','P003',52,true,false),
('MSL0014','P004',13,false,false),
('MSL0014','P001',-29,false,false),
('MSL0014','P005',-36,false,false),
('MSL0014','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0015','S1',15,'2024-08-23','五人局','阅谈共享茶室（后江店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0015','P002',45,true,false),
('MSL0015','P004',21,false,false),
('MSL0015','P005',6,false,false),
('MSL0015','P003',-31,false,false),
('MSL0015','P001',-41,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0016','S1',16,'2024-09-03','五人局','七囍茶室（厦门站店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0016','P005',51,true,false),
('MSL0016','P002',40,false,false),
('MSL0016','P004',3,false,false),
('MSL0016','P001',-34,false,false),
('MSL0016','P003',-60,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0017','S1',17,'2024-09-12','五人局','喜上茶社',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0017','P004',32,true,false),
('MSL0017','P003',25,false,false),
('MSL0017','P002',16,false,false),
('MSL0017','P005',-33,false,false),
('MSL0017','P001',-40,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0018','S1',18,'2024-09-19','四人局','喜上茶社',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0018','P003',30,true,false),
('MSL0018','P004',17,false,false),
('MSL0018','P002',-4,false,false),
('MSL0018','P001',-43,false,false),
('MSL0018','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0019','S1',19,'2024-10-01','四人局','赢雀斯听棋牌室（莲花店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0019','P002',85,true,false),
('MSL0019','P001',-5,false,false),
('MSL0019','P003',-26,false,false),
('MSL0019','P005',-54,false,false),
('MSL0019','P004',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0020','S1',20,'2024-10-06','四人局','嗨范棋牌室（万象城店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0020','P001',101,true,false),
('MSL0020','P005',-26,false,false),
('MSL0020','P003',-35,false,false),
('MSL0020','P004',-40,false,false),
('MSL0020','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0021','S1',21,'2024-10-17','四人局','嗨范棋牌室（万象城店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0021','P003',35,true,false),
('MSL0021','P001',21,false,false),
('MSL0021','P004',-26,false,false),
('MSL0021','P005',-30,false,false),
('MSL0021','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0022','S1',22,'2024-10-30','四人局','四季风享棋牌室（洪文店）',false,'S1第22局：比赛类型修正为常规赛四人局','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0022','P004',39,true,false),
('MSL0022','P002',31,false,false),
('MSL0022','P003',-26,false,false),
('MSL0022','P001',-44,false,false),
('MSL0022','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0023','S1',23,'2024-11-05','五人局','胡小鸭共享棋牌室（金尚店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0023','P002',37,true,false),
('MSL0023','P001',9,false,false),
('MSL0023','P003',6,false,false),
('MSL0023','P004',-26,false,false),
('MSL0023','P005',-26,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0024','S1',24,'2024-11-14','四人局','胡小鸭共享棋牌室（火车站店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0024','P003',70,true,false),
('MSL0024','P002',-20,false,false),
('MSL0024','P001',-23,false,false),
('MSL0024','P004',-27,false,false),
('MSL0024','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0025','S1',25,'2024-11-20','五人局','胡小鸭共享棋牌室（火车站店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0025','P003',32,true,false),
('MSL0025','P001',20,false,false),
('MSL0025','P002',-10,false,false),
('MSL0025','P005',-16,false,false),
('MSL0025','P004',-26,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0026','S1',26,'2024-12-02','五人局','拾月金秋茶馆',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0026','P001',44,true,false),
('MSL0026','P003',9,false,false),
('MSL0026','P004',6,false,false),
('MSL0026','P002',-14,false,false),
('MSL0026','P005',-45,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0027','S2',1,'2025-02-12','四人局','七囍茶室（厦门站店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0027','P002',54,true,false),
('MSL0027','P001',21,false,false),
('MSL0027','P003',-33,false,false),
('MSL0027','P004',-42,false,false),
('MSL0027','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0028','S2',2,'2025-03-07','四人局','七囍茶室（厦门站店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0028','P001',8,true,false),
('MSL0028','P002',3,false,false),
('MSL0028','P003',2,false,false),
('MSL0028','P004',-13,false,false),
('MSL0028','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0029','S2',3,'2025-03-21','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0029','P004',24,true,false),
('MSL0029','P003',7,false,false),
('MSL0029','P005',-1,false,false),
('MSL0029','P001',-15,false,false),
('MSL0029','P002',-15,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0030','S2',4,'2025-03-27','四人局','拾月金秋茶馆（浦南一里店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0030','P003',30,true,false),
('MSL0030','P004',14,false,false),
('MSL0030','P001',-7,false,false),
('MSL0030','P005',-37,false,false),
('MSL0030','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0031','S2',5,'2025-03-31','四人局','四季风享棋牌室（洪文店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0031','P002',24,true,false),
('MSL0031','P004',-3,false,false),
('MSL0031','P003',-9,false,false),
('MSL0031','P001',-12,false,false),
('MSL0031','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0032','S2',6,'2025-04-10','四人局','嗨范棋牌室（万象城店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0032','P001',42,true,false),
('MSL0032','P005',-6,false,false),
('MSL0032','P003',-10,false,false),
('MSL0032','P004',-26,false,false),
('MSL0032','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0033','S2',7,'2025-04-17','四人局','阅谈共享茶室（后江店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0033','P001',26,true,false),
('MSL0033','P004',0,false,false),
('MSL0033','P003',-11,false,false),
('MSL0033','P002',-15,false,false),
('MSL0033','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0034','S2',8,'2025-05-04','四人局','拾月金秋茶馆（浦南一里店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0034','P003',27,true,false),
('MSL0034','P004',9,false,false),
('MSL0034','P001',-18,false,false),
('MSL0034','P005',-18,false,false),
('MSL0034','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0035','S2',9,'2025-05-17','四人局','嗨范棋牌室（万象城店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0035','P004',19,true,false),
('MSL0035','P001',10,false,false),
('MSL0035','P005',9,false,false),
('MSL0035','P003',-38,false,false),
('MSL0035','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0036','S2',10,'2025-05-21','四人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0036','P002',31,true,false),
('MSL0036','P004',14,false,false),
('MSL0036','P001',-19,false,false),
('MSL0036','P003',-26,false,false),
('MSL0036','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0037','S2',11,'2025-06-05','五人局','七囍茶室（厦门站店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0037','P003',72,true,false),
('MSL0037','P002',11,false,false),
('MSL0037','P001',-2,false,false),
('MSL0037','P004',-23,false,false),
('MSL0037','P005',-58,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0038','S2',12,'2025-06-18','四人局','嗨范棋牌室（万象城店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0038','P003',17,true,false),
('MSL0038','P001',-2,false,false),
('MSL0038','P005',-5,false,false),
('MSL0038','P004',-10,false,false),
('MSL0038','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0039','S2',13,'2025-07-24','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0039','P004',37,true,false),
('MSL0039','P001',17,false,false),
('MSL0039','P002',11,false,false),
('MSL0039','P003',-16,false,false),
('MSL0039','P005',-49,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0040','S2',14,'2025-08-05','四人局','拾月金秋茶馆（浦南一里店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0040','P002',53,true,false),
('MSL0040','P004',-6,false,false),
('MSL0040','P001',-7,false,false),
('MSL0040','P003',-40,false,false),
('MSL0040','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0041','S2',15,'2025-08-14','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0041','P003',37,true,false),
('MSL0041','P004',5,false,false),
('MSL0041','P001',-5,false,false),
('MSL0041','P002',-11,false,false),
('MSL0041','P005',-26,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0042','S2',16,'2025-10-04','五人局','胡小鸭共享棋牌室（厦大店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0042','P001',93,true,false),
('MSL0042','P003',10,false,false),
('MSL0042','P002',10,false,false),
('MSL0042','P004',-53,false,false),
('MSL0042','P005',-60,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0043','S2',17,'2025-10-04','五人局','雀家（厦大店）',false,'S2第17局：陈荣升由6修正为12','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0043','P003',17,true,false),
('MSL0043','P002',17,true,false),
('MSL0043','P005',12,false,false),
('MSL0043','P004',-15,false,false),
('MSL0043','P001',-31,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0044','S2',18,'2025-11-12','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0044','P001',35,true,false),
('MSL0044','P002',30,false,false),
('MSL0044','P003',21,false,false),
('MSL0044','P004',-9,false,false),
('MSL0044','P005',-77,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0045','S2',19,'2025-11-20','四人局','嗨范棋牌室（万象城店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0045','P001',73,true,false),
('MSL0045','P004',-9,false,false),
('MSL0045','P003',-24,false,false),
('MSL0045','P005',-40,false,false),
('MSL0045','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0046','S2',20,'2025-11-27','四人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0046','P004',50,true,false),
('MSL0046','P001',14,false,false),
('MSL0046','P002',-31,false,false),
('MSL0046','P003',-33,false,false),
('MSL0046','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0047','S2',21,'2025-12-04','四人局','七囍茶室（厦门站店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0047','P001',55,true,false),
('MSL0047','P003',-10,false,false),
('MSL0047','P004',-12,false,false),
('MSL0047','P005',-33,false,false),
('MSL0047','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0048','S2',22,'2025-12-24','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0048','P004',72,true,false),
('MSL0048','P001',-8,false,false),
('MSL0048','P003',-13,false,false),
('MSL0048','P002',-25,false,false),
('MSL0048','P005',-26,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0049','S3',1,'2026-01-04','四人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0049','P003',39,true,false),
('MSL0049','P002',7,false,false),
('MSL0049','P001',0,false,false),
('MSL0049','P005',-46,false,false),
('MSL0049','P004',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0050','S3',2,'2026-01-30','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0050','P001',43,true,false),
('MSL0050','P003',19,false,false),
('MSL0050','P004',-7,false,false),
('MSL0050','P002',-18,false,false),
('MSL0050','P005',-37,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0051','S3',3,'2026-03-06','四人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0051','P001',42,true,false),
('MSL0051','P002',34,false,false),
('MSL0051','P003',-35,false,false),
('MSL0051','P004',-41,false,false),
('MSL0051','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0052','S3',4,'2026-03-19','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0052','P002',26,true,false),
('MSL0052','P005',21,false,false),
('MSL0052','P004',4,false,false),
('MSL0052','P003',-3,false,false),
('MSL0052','P001',-48,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0053','S3',5,'2026-03-27','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0053','P001',28,true,false),
('MSL0053','P002',16,false,false),
('MSL0053','P004',-1,false,false),
('MSL0053','P003',-15,false,false),
('MSL0053','P005',-28,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0054','S3',6,'2026-04-09','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0054','P001',16,true,false),
('MSL0054','P003',15,false,false),
('MSL0054','P005',-4,false,false),
('MSL0054','P002',-10,false,false),
('MSL0054','P004',-17,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0055','S3',7,'2026-04-23','四人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0055','P001',76,true,false),
('MSL0055','P002',7,false,false),
('MSL0055','P003',-32,false,false),
('MSL0055','P005',-51,false,false),
('MSL0055','P004',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0056','S3',8,'2026-04-30','五人局','大唐茶馆（金山店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0056','P004',46,true,false),
('MSL0056','P001',1,false,false),
('MSL0056','P002',-7,false,false),
('MSL0056','P003',-13,false,false),
('MSL0056','P005',-27,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0057','S3',9,'2026-05-07','四人局','胡小鸭共享棋牌室（金尚店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0057','P001',24,true,false),
('MSL0057','P002',16,false,false),
('MSL0057','P003',11,false,false),
('MSL0057','P005',-51,false,false),
('MSL0057','P004',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0058','S3',10,'2026-05-13','五人局','胡小鸭共享棋牌室（金尚店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0058','P001',49,true,false),
('MSL0058','P002',33,false,false),
('MSL0058','P004',-24,false,false),
('MSL0058','P005',-24,false,false),
('MSL0058','P003',-34,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0059','S3',11,'2026-05-27','四人局','嗨范棋牌室（万象城店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0059','P003',69,true,false),
('MSL0059','P002',-4,false,false),
('MSL0059','P004',-14,false,false),
('MSL0059','P001',-51,false,false),
('MSL0059','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0060','S3',12,'2026-06-03','四人局','四个朋友（联发欣悦店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0060','P001',38,true,false),
('MSL0060','P005',-2,false,false),
('MSL0060','P003',-10,false,false),
('MSL0060','P002',-26,false,false),
('MSL0060','P004',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0061','S3',13,'2026-06-12','五人局','拾贰茶铺（SM店）',true,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0061','P001',33,true,false),
('MSL0061','P005',3,false,false),
('MSL0061','P004',-2,false,false),
('MSL0061','P002',-13,false,false),
('MSL0061','P003',-21,false,false)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0062','S3',14,'2026-06-25','四人局','拾贰茶铺（SM店）',true,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0062','P002',22,true,false),
('MSL0062','P001',11,false,false),
('MSL0062','P003',10,false,false),
('MSL0062','P004',-43,false,false),
('MSL0062','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0063','S3',15,'2026-07-03','四人局','见之共享茶室（火炬园店）',false,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0063','P004',90,true,false),
('MSL0063','P003',30,false,false),
('MSL0063','P002',-49,false,false),
('MSL0063','P001',-71,false,false),
('MSL0063','P005',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0064','S3',16,'2026-07-10','四人局','拾贰茶铺（SM店）',true,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0064','P004',45,true,false),
('MSL0064','P003',44,false,false),
('MSL0064','P005',-25,false,false),
('MSL0064','P001',-64,false,false),
('MSL0064','P002',null,false,true)
on conflict(match_id,player_id) do nothing;
insert into public.matches(id,season_id,round,match_date,match_type,venue,is_home_venue,notes,status) values('MSL0065','S3',17,'2026-07-16','五人局','拾贰茶铺（SM店）',true,'','official') on conflict(id) do nothing;
insert into public.match_results(match_id,player_id,score,is_mvp,is_absent) values
('MSL0065','P004',70,true,false),
('MSL0065','P002',19,false,false),
('MSL0065','P005',-18,false,false),
('MSL0065','P001',-24,false,false),
('MSL0065','P003',-47,false,false)
on conflict(match_id,player_id) do nothing;
commit;
insert into public.award_results(player_id,scope,award_id,award_name,grade,category,value,points,status,certified_version) values
('P001','CAREER','H009','MVP之王','B','数据荣誉',20,5,'VERIFIED','v10.1 LTS Official'),
('P001','CAREER','H020','麻将刺客','C','趣味荣誉',86.1224489795918,0,'VERIFIED','v10.1 LTS Official'),
('P001','CAREER','H022','大满贯','D','终身成就',1,0,'ACHIEVED','v10.1 LTS Official'),
('P001','CAREER','H023','荣誉王','D','终身成就',124,0,'CURRENT','v10.1 LTS Official'),
('P001','CAREER','H024','二十MVP先生','D','终身成就',20,0,'ACHIEVED','v10.1 LTS Official'),
('P001','S1','H007','铁人奖','B','数据荣誉',26,5,'VERIFIED','v10.1 LTS Official'),
('P001','S1','H008','大场面先生','B','数据荣誉',15,5,'VERIFIED','v10.1 LTS Official'),
('P001','S1','H016','大胜专家','B','成就荣誉',7,5,'VERIFIED','v10.1 LTS Official'),
('P001','S1','H021','翻车王','C','趣味荣誉',4,0,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H001','MSL赛季冠军','A','最高荣誉',268,10,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H002','年度最佳牌手','A','最高荣誉',97.5,15,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H003','赛季MVP','A','最高荣誉',7,7,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H004','得分王','B','数据荣誉',12.1818181818182,5,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H006','连庄王','B','数据荣誉',4,5,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H007','铁人奖','B','数据荣誉',22,5,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H008','大场面先生','B','数据荣誉',12,5,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H015','低估反弹王','B','成就荣誉',18.1818181818182,5,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H016','大胜专家','B','成就荣誉',4,5,'VERIFIED','v10.1 LTS Official'),
('P001','S2','H018','过山车奖','C','趣味荣誉',30.6766662341212,0,'VERIFIED','v10.1 LTS Official'),
('P001','S3','H003','赛季MVP','A','最高荣誉',9,7,'VERIFIED','v10.1 LTS Official'),
('P001','S3','H005','稳定先生','B','数据荣誉',0.705882352941177,5,'VERIFIED','v10.1 LTS Official'),
('P001','S3','H006','连庄王','B','数据荣誉',6,5,'VERIFIED','v10.1 LTS Official'),
('P001','S3','H007','铁人奖','B','数据荣誉',17,5,'VERIFIED','v10.1 LTS Official'),
('P001','S3','H012','五人局之王','B','场景荣誉',12.25,5,'VERIFIED','v10.1 LTS Official'),
('P001','S3','H018','过山车奖','C','趣味荣誉',42.0468514429199,0,'VERIFIED','v10.1 LTS Official'),
('P001','S3','H021','翻车王','C','趣味荣誉',4,0,'VERIFIED','v10.1 LTS Official'),
('P001','S3','H002','年度最佳牌手','A','最高荣誉',82.8826556351529,15,'VERIFIED','v10.1 LTS Official'),
('P002','S1','H001','MSL赛季冠军','A','最高荣誉',168,10,'VERIFIED','v10.1 LTS Official'),
('P002','S1','H002','年度最佳牌手','A','最高荣誉',85.5178571428572,15,'VERIFIED','v10.1 LTS Official'),
('P002','S1','H004','得分王','B','数据荣誉',8,5,'VERIFIED','v10.1 LTS Official'),
('P002','S1','H015','低估反弹王','B','成就荣誉',24.0545454545455,5,'VERIFIED','v10.1 LTS Official'),
('P002','S1','H019','鸽王','C','趣味荣誉',5,0,'VERIFIED','v10.1 LTS Official'),
('P002','S2','H005','稳定先生','B','数据荣誉',0.666666666666667,5,'VERIFIED','v10.1 LTS Official'),
('P002','S2','H006','连庄王','B','数据荣誉',4,5,'VERIFIED','v10.1 LTS Official'),
('P002','S2','H011','四人局之王','B','场景荣誉',17,5,'VERIFIED','v10.1 LTS Official'),
('P002','S2','H019','鸽王','C','趣味荣誉',7,0,'VERIFIED','v10.1 LTS Official'),
('P003','S1','H003','赛季MVP','A','最高荣誉',9,7,'VERIFIED','v10.1 LTS Official'),
('P003','S1','H007','铁人奖','B','数据荣誉',26,5,'VERIFIED','v10.1 LTS Official'),
('P003','S1','H011','四人局之王','B','场景荣誉',13,5,'VERIFIED','v10.1 LTS Official'),
('P003','S1','H013','关键局之王','B','场景荣誉',111,5,'VERIFIED','v10.1 LTS Official'),
('P003','S1','H018','过山车奖','C','趣味荣誉',35.372259548439,0,'VERIFIED','v10.1 LTS Official'),
('P003','S2','H006','连庄王','B','数据荣誉',4,5,'VERIFIED','v10.1 LTS Official'),
('P003','S2','H007','铁人奖','B','数据荣誉',22,5,'VERIFIED','v10.1 LTS Official'),
('P003','S2','H012','五人局之王','B','场景荣誉',16.875,5,'VERIFIED','v10.1 LTS Official'),
('P003','S3','H007','铁人奖','B','数据荣誉',17,5,'VERIFIED','v10.1 LTS Official'),
('P003','S3','H011','四人局之王','B','场景荣誉',14,5,'VERIFIED','v10.1 LTS Official'),
('P004','S1','H005','稳定先生','B','数据荣誉',0.64,5,'VERIFIED','v10.1 LTS Official'),
('P004','S1','H006','连庄王','B','数据荣誉',6,5,'VERIFIED','v10.1 LTS Official'),
('P004','S1','H012','五人局之王','B','场景荣誉',8.13333333333333,5,'VERIFIED','v10.1 LTS Official'),
('P004','S2','H006','连庄王','B','数据荣誉',4,5,'VERIFIED','v10.1 LTS Official'),
('P004','S2','H007','铁人奖','B','数据荣誉',22,5,'VERIFIED','v10.1 LTS Official'),
('P004','S2','H013','关键局之王','B','场景荣誉',110,5,'VERIFIED','v10.1 LTS Official'),
('P004','S3','H001','MSL赛季冠军','A','最高荣誉',106,10,'VERIFIED','v10.1 LTS Official'),
('P004','S3','H004','得分王','B','数据荣誉',8.15384615384615,5,'VERIFIED','v10.1 LTS Official'),
('P004','S3','H008','大场面先生','B','数据荣誉',11,5,'VERIFIED','v10.1 LTS Official'),
('P004','S3','H013','关键局之王','B','场景荣誉',205,5,'VERIFIED','v10.1 LTS Official'),
('P004','S3','H015','低估反弹王','B','成就荣誉',20.0952380952381,5,'VERIFIED','v10.1 LTS Official'),
('P004','S3','H016','大胜专家','B','成就荣誉',4,5,'VERIFIED','v10.1 LTS Official'),
('P004','S3','H019','鸽王','C','趣味荣誉',4,0,'VERIFIED','v10.1 LTS Official'),
('P005','S1','H017','财神爷','C','趣味荣誉',-342,0,'VERIFIED','v10.1 LTS Official'),
('P005','S1','H019','鸽王','C','趣味荣誉',5,0,'VERIFIED','v10.1 LTS Official'),
('P005','S2','H017','财神爷','C','趣味荣誉',-415,0,'VERIFIED','v10.1 LTS Official'),
('P005','S2','H019','鸽王','C','趣味荣誉',7,0,'VERIFIED','v10.1 LTS Official'),
('P005','S2','H021','翻车王','C','趣味荣誉',5,0,'VERIFIED','v10.1 LTS Official'),
('P005','S3','H017','财神爷','C','趣味荣誉',-289,0,'VERIFIED','v10.1 LTS Official'),
('P005','S3','H019','鸽王','C','趣味荣誉',4,0,'VERIFIED','v10.1 LTS Official')
on conflict(player_id,scope,award_id) do update set value=excluded.value,points=excluded.points,status=excluded.status;
insert into public.system_versions(version,release_date,stage,status,formula_integrity,certification,note) values('v10.1 LTS Official','2026-07-19','Official LTS Release','H002 rule revised / LTS maintained','PASS','OFFICIAL VERIFIED','v10.1 LTS adopts the official H002 weighting: 35% points, 25% MVP, 15% average, 10% positive rate, 10% BGR, 5% champion bonus.') on conflict(version) do nothing;
