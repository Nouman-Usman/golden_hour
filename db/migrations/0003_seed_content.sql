INSERT INTO "settings" ("id","whatsapp","phone","address","instagram_url","maps_url","maps_embed_url","google_rating","google_review_count","instagram_followers","delivery_fee","shop_open") VALUES (1,'https://wa.me/923214220245','+92 321 4220245','305 Sagar Road, Saddar Cantt, Lahore','https://www.instagram.com/golden_hour_21/','https://www.google.com/maps/place/Golden+Hour+Fitness+Planet/@31.54876,74.377006,17z','https://www.google.com/maps?q=Golden+Hour+Fitness+Planet,+305+Sagar+Rd,+Saddar+Cantt,+Lahore&output=embed','4.7',23,'5.6k',250,true);--> statement-breakpoint
INSERT INTO "timings" ("label","hours","position") VALUES
('Women','10 am – 5 pm',0),
('Everyone, morning','6 am – 10 am',1),
('Everyone, evening','5 pm – 1 am',2);--> statement-breakpoint
INSERT INTO "programs" ("title","body","position") VALUES
('Open floor membership','Free weights, machines and cardio, with a trainer on the floor whenever you train.',0),
('Personal training','One-to-one sessions with a certified coach who plans, spots and corrects every set.',1),
('Women''s sessions','Dedicated daytime hours for women, with female members training alongside each other.',2),
('Transformation and diet plans','A training block paired with a meal plan, checked in on until the numbers move.',3);--> statement-breakpoint
INSERT INTO "coach" ("id","name","bio","photo_url") VALUES (1,'Head coach','Our head coach doesn''t just train people, he competes: Mr City Lahore, and Mr Pakistan in classic physique. The same eye that prepares him for stage checks your form on the floor.','/images/coach.jpg');--> statement-breakpoint
INSERT INTO "gallery_images" ("kind","url","alt","caption","position") VALUES
('floor','/images/reception.jpg','Brass Golden Hour reception desk against a black wall','Reception',0),
('floor','/images/floor-lamps.jpg','Long dumbbell rack under brass pendant lamps','Free weights',1),
('floor','/images/leg-zone.jpg','Leg press and hack squat machines on turf','Leg machines',2),
('floor','/images/cardio-corner.jpg','Air bikes, treadmill and cable station','Cardio and cables',3),
('floor','/images/mirror-wall.jpg','Squat racks in front of lit mirror wall','Racks',4),
('floor','/images/dumbbells.jpg','Close-up of a rubber dumbbell rack','Dumbbells',5),
('members','/images/ig/037.jpg','Golden Hour member',NULL,0),
('members','/images/ig/043.jpg','Golden Hour member',NULL,1),
('members','/images/ig/059.jpg','Golden Hour member',NULL,2),
('members','/images/ig/063.jpg','Golden Hour member',NULL,3),
('members','/images/ig/068.jpg','Golden Hour member',NULL,4),
('members','/images/ig/080.jpg','Golden Hour member',NULL,5),
('members','/images/ig/119.jpg','Golden Hour member',NULL,6),
('members','/images/ig/155.jpg','Golden Hour member',NULL,7),
('members','/images/ig/161.jpg','Golden Hour member',NULL,8),
('members','/images/ig/185.jpg','Golden Hour member',NULL,9),
('members','/images/ig/204.jpg','Golden Hour member',NULL,10),
('members','/images/ig/208.jpg','Golden Hour member',NULL,11);--> statement-breakpoint
INSERT INTO "reviews" ("quote","author","featured","position") VALUES
('The trainer has become Mr Pakistan in classic physique. The atmosphere is very friendly, and they broke records of cleanliness of other gyms near them.','Google review',true,0),
('Good for physical exercise, with a trainer available all the time for males and females. The people who train here are very nice and helpful.','Google review',false,1),
('Gym is fantastic and facilities are amazing.','MohiD Ali, Google review',false,2);
