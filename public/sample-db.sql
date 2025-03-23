-- TABLES

CREATE TABLE subscriptions (
    subscription_id INT AUTO_INCREMENT PRIMARY KEY,
    plan_name VARCHAR(255) NOT NULL,
    price DECIMAL(10, 2) NOT NULL,
    features TEXT,  -- JSON or comma-separated list of features
    duration_days INT
);

CREATE TABLE users (
    user_id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- Store hashed passwords!
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    profile_picture_url VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    subscription_id INT,
    FOREIGN KEY (subscription_id) REFERENCES subscriptions (subscription_id)
);

CREATE TABLE artists (
    artist_id INT AUTO_INCREMENT PRIMARY KEY,
    artist_name VARCHAR(255) NOT NULL,
    artist_bio TEXT,
    artist_image_url VARCHAR(255)
);

CREATE TABLE albums (
    album_id INT AUTO_INCREMENT PRIMARY KEY,
    artist_id INT,
    album_name VARCHAR(255) NOT NULL,
    release_date DATE,
    album_art_url VARCHAR(255),
    FOREIGN KEY (artist_id) REFERENCES artists (artist_id)
);

CREATE TABLE tracks (
    track_id INT AUTO_INCREMENT PRIMARY KEY,
    album_id INT,
    track_name VARCHAR(255) NOT NULL,
    duration_seconds INT,
    track_url VARCHAR(255) NOT NULL,  -- Location on CDN
    genre VARCHAR(255),
    track_number INT,
    FOREIGN KEY (album_id) REFERENCES albums (album_id)
);

CREATE TABLE playlists (
    playlist_id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT,
    playlist_name VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    is_public BOOLEAN DEFAULT TRUE,
     FOREIGN KEY (user_id) REFERENCES users (user_id)
);

CREATE TABLE playlist_tracks (
    playlist_id INT,
    track_id INT,
    added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (playlist_id, track_id),
    FOREIGN KEY (playlist_id) REFERENCES playlists (playlist_id),
    FOREIGN KEY (track_id) REFERENCES tracks (track_id)
);


CREATE TABLE user_follows_artist (
    user_id INT,
    artist_id INT,
    followed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, artist_id),
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (artist_id) REFERENCES artists (artist_id)
);

CREATE TABLE user_listens_track (
    user_id INT,
    track_id INT,
    listened_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, track_id, listened_at),
    FOREIGN KEY (user_id) REFERENCES users (user_id),
    FOREIGN KEY (track_id) REFERENCES tracks (track_id)
);

-- SAMPLE DATA

-- SUBSCRIPTIONS (Expanding to 4 Plans)
INSERT INTO subscriptions (plan_name, price, features, duration_days) VALUES
('Free', 0.00, 'Ad-supported, Limited skips, Lower audio quality', NULL),
('Premium', 9.99, 'Ad-free, Unlimited skips, High audio quality, Offline downloads', 30),
('Family', 14.99, 'Premium features for up to 6 family members', 30),
('Student', 4.99, 'Premium features for students with verification', 30);

-- USERS (Expanding to 15)
INSERT INTO users (username, email, password_hash, first_name, last_name, subscription_id) VALUES
('johndoe', 'john.doe@example.com', 'hashed_password_1', 'John', 'Doe', 2),
('janesmith', 'jane.smith@example.com', 'hashed_password_2', 'Jane', 'Smith', 1),
('peterjones', 'peter.jones@example.com', 'Peter', 'Jones', 'hashed_password_3', 3),
('alicebrown', 'alice.brown@example.com', 'hashed_password_4', 'Alice', 'Brown', 2),
('bobwilliams', 'bob.williams@example.com', 'hashed_password_5', 'Bob', 'Williams', 1),
('charliegarcia', 'charlie.garcia@example.com', 'Charlie', 'Garcia', 'hashed_password_6', 3),
('davidmartinez', 'david.martinez@example.com', 'hashed_password_7', 'David', 'Martinez', 2),
('evamiller', 'eva.miller@example.com', 'hashed_password_8', 'Eva', 'Miller', 4),
('frankdavis', 'frank.davis@example.com', 'hashed_password_9', 'Frank', 'Davis', 1),
('graceanderson', 'grace.anderson@example.com', 'Grace', 'Anderson', 'hashed_password_10', 3),
('henrythomas', 'henry.thomas@example.com', 'hashed_password_11', 'Henry', 'Thomas', 2),
('isabellamoore', 'isabella.moore@example.com', 'hashed_password_12', 'Isabella', 'Moore', 4),
('jacktaylor', 'jack.taylor@example.com', 'hashed_password_13', 'Jack', 'Taylor', 1),
('katieroberts', 'katie.roberts@example.com', 'Katie', 'Roberts', 'hashed_password_14', 3),
('liamjackson', 'liam.jackson@example.com', 'hashed_password_15', 'Liam', 'Jackson', 2);


-- ARTISTS (Expanding to 15)
INSERT INTO artists (artist_name, artist_bio, artist_image_url) VALUES
('The Beatles', 'One of the most influential bands in history.', 'beatles.jpg'),
('Billie Eilish', 'American singer and songwriter.', 'billie_eilish.jpg'),
('Queen', 'British rock band formed in London in 1970.', 'queen.jpg'),
('Taylor Swift', 'American singer-songwriter.', 'taylor_swift.jpg'),
('Drake', 'Canadian rapper, singer, and actor.', 'drake.jpg'),
('Ed Sheeran', 'English singer-songwriter.', 'ed_sheeran.jpg'),
('Ariana Grande', 'American singer and actress.', 'ariana_grande.jpg'),
('The Weeknd', 'Canadian singer, songwriter, and record producer.', 'the_weeknd.jpg'),
('BTS', 'South Korean boy band.', 'bts.jpg'),
('Dua Lipa', 'English singer and songwriter.', 'dua_lipa.jpg'),
('Justin Bieber', 'Canadian singer.', 'justin_bieber.jpg'),
('Harry Styles', 'English singer, songwriter, and actor.', 'harry_styles.jpg'),
('Olivia Rodrigo', 'American singer-songwriter and actress.', 'olivia_rodrigo.jpg'),
('Post Malone', 'American rapper, singer, songwriter, and record producer.', 'post_malone.jpg'),
('Adele', 'English singer-songwriter.', 'adele.jpg');

-- ALBUMS (Expanding to 15)
INSERT INTO albums (artist_id, album_name, release_date, album_art_url) VALUES
(1, 'Abbey Road', '1969-09-26', 'abbey_road.jpg'),
(2, 'WHEN WE ALL FALL ASLEEP, WHERE DO WE GO?', '2019-03-29', 'wwafawdwg.jpg'),
(3, 'A Night at the Opera', '1975-11-21', 'night_at_the_opera.jpg'),
(4, 'Red (Taylor''s Version)', '2021-11-12', 'red_tv.jpg'),
(5, 'Certified Lover Boy', '2021-09-03', 'clb.jpg'),
(6, 'Divide', '2017-03-03', 'divide.jpg'),
(7, 'Positions', '2020-10-30', 'positions.jpg'),
(8, 'After Hours', '2020-03-20', 'after_hours.jpg'),
(9, 'Map of the Soul: 7', '2020-02-21', 'mot7.jpg'),
(10, 'Future Nostalgia', '2020-03-27', 'future_nostalgia.jpg'),
(11, 'Justice', '2021-03-19', 'justice.jpg'),
(12, 'Fine Line', '2019-12-13', 'fine_line.jpg'),
(13, 'SOUR', '2021-05-21', 'sour.jpg'),
(14, 'beerbongs & bentleys', '2018-04-27', 'beerbongs.jpg'),
(15, '25', '2015-11-20', '25.jpg');

-- TRACKS (Expanding to 20 - Distributing Among Albums)
INSERT INTO tracks (album_id, track_name, duration_seconds, track_url, genre, track_number) VALUES
(1, 'Come Together', 260, 'cdn/abbey_road/come_together.mp3', 'Rock', 1),
(1, 'Something', 182, 'cdn/abbey_road/something.mp3', 'Rock', 2),
(2, 'bad guy', 194, 'cdn/billie/bad_guy.mp3', 'Pop', 1),
(3, 'Bohemian Rhapsody', 355, 'cdn/queen/bohemian_rhapsody.mp3', 'Rock', 1),
(4, 'All Too Well (10 Minute Version)', 613, 'cdn/taylor/all_too_well.mp3', 'Pop', 5),
(5, 'Way 2 Sexy (feat. Future & Young Thug)', 257, 'cdn/drake/way2sexy.mp3', 'Hip Hop', 3),
(6, 'Shape of You', 233, 'cdn/ed/shape_of_you.mp3', 'Pop', 1),
(7, 'positions', 172, 'cdn/ariana/positions.mp3', 'Pop', 1),
(8, 'Blinding Lights', 200, 'cdn/weeknd/blinding_lights.mp3', 'Pop', 2),
(9, 'ON', 246, 'cdn/bts/on.mp3', 'K-Pop', 4),
(10, 'Don''t Start Now', 183, 'cdn/dua/dont_start_now.mp3', 'Pop', 1),
(11, 'Peaches (feat. Daniel Caesar & Giveon)', 198, 'cdn/justin/peaches.mp3', 'Pop', 6),
(12, 'Watermelon Sugar', 174, 'cdn/harry/watermelon_sugar.mp3', 'Pop', 3),
(13, 'drivers license', 242, 'cdn/olivia/drivers_license.mp3', 'Pop', 1),
(14, 'rockstar (feat. 21 Savage)', 218, 'cdn/post/rockstar.mp3', 'Hip Hop', 7),
(15, 'Hello', 305, 'cdn/adele/hello.mp3', 'Pop', 1),
(1, 'Here Comes the Sun', 185, 'cdn/abbey_road/here_comes_the_sun.mp3', 'Rock', 7),
(2, 'bury a friend', 193, 'cdn/billie/bury_a_friend.mp3', 'Pop', 3),
(3, 'You''re My Best Friend', 170, 'cdn/queen/youre_my_best_friend.mp3', 'Rock', 4),
(4, '22 (Taylor''s Version)', 230, 'cdn/taylor/22_tv.mp3', 'Pop', 2);

-- PLAYLISTS (Expanding to 15)
INSERT INTO playlists (user_id, playlist_name) VALUES
(1, 'Johns Rock Favorites'),
(2, 'Jane''s Chill Mix'),
(3, 'Peter''s Workout Playlist'),
(4, 'Alice''s Study Music'),
(5, 'Bob''s Country Hits'),
(6, 'Charlie''s Party Anthems'),
(7, 'David''s Indie Vibes'),
(8, 'Eva''s Classical Collection'),
(9, 'Frank''s Jazz Standards'),
(10, 'Grace''s Electronic Beats'),
(11, 'Henry''s 80s Throwbacks'),
(12, 'Isabella''s K-Pop Obsession'),
(13, 'Jack''s Reggae Rhythms'),
(14, 'Katie''s Acoustic Covers'),
(15, 'Liam''s Hip Hop Essentials');

-- PLAYLIST_TRACKS (Expanding Significantly - More varied playlist content)
INSERT INTO playlist_tracks (playlist_id, track_id) VALUES
(1, 1),  -- John's Rock Favorites
(1, 4),
(1, 17),
(1, 19),
(2, 2),  -- Jane's Chill Mix
(2, 3),
(2, 7),
(2, 16),
(3, 5),  -- Peter's Workout Playlist
(3, 8),
(3, 11),
(4, 15),  -- Alice's Study Music
(4, 17),
(4, 1),
(5, 10), -- Bob's Country Hits
(5, 11),
(5, 12),
(6, 13),  -- Charlie's Party Anthems
(6, 14),
(6, 18),
(7, 19),   -- David's Indie Vibes
(7, 1),
(7, 2),
(8, 3), -- Eva's Classical Collection
(8, 4),
(8, 5),
(9, 6),   -- Frank's Jazz Standards
(9, 7),
(9, 8),
(10, 9),  -- Grace's Electronic Beats
(10, 10),
(10, 11),
(11, 12), -- Henry's 80s Throwbacks
(11, 13),
(11, 14),
(12, 15),  -- Isabella's K-Pop Obsession
(12, 16),
(12, 17),
(13, 18),   -- Jack's Reggae Rhythms
(13, 19),
(13, 20),
(14, 1), -- Katie's Acoustic Covers
(14, 2),
(14, 3),
(15, 4),  -- Liam's Hip Hop Essentials
(15, 5),
(15, 6);

-- USER FOLLOWS ARTIST (Expanding to 20+)
INSERT INTO user_follows_artist (user_id, artist_id) VALUES
(1, 1),
(1, 3),
(2, 2),
(2, 4),
(3, 5),
(3, 6),
(4, 7),
(4, 8),
(5, 9),
(5, 10),
(6, 11),
(6, 12),
(7, 13),
(7, 14),
(8, 15),
(8, 1),
(9, 2),
(9, 3),
(10, 4),
(10, 5),
(11, 6),
(11, 7),
(12, 8),
(12, 9);

-- USER LISTENS TRACK (Expanding - Simulate listening history)
INSERT INTO user_listens_track (user_id, track_id, listened_at) VALUES
(1, 1, DATE_SUB(NOW(), INTERVAL 2 DAY)),
(1, 1, DATE_SUB(NOW(), INTERVAL 1 DAY)),
(1, 1, NOW()),
(2, 3, DATE_SUB(NOW(), INTERVAL 3 DAY)),
(2, 3, NOW()),
(3, 5, DATE_SUB(NOW(), INTERVAL 1 HOUR)),
(4, 7, DATE_SUB(NOW(), INTERVAL 30 MINUTE)),
(5, 9, DATE_SUB(NOW(), INTERVAL 1 WEEK)),
(6, 11, DATE_SUB(NOW(), INTERVAL 2 WEEK)),
(7, 13, DATE_SUB(NOW(), INTERVAL 4 DAY)),
(8, 15, DATE_SUB(NOW(), INTERVAL 5 DAY)),
(9, 2, DATE_SUB(NOW(), INTERVAL 6 DAY)),
(10, 4, DATE_SUB(NOW(), INTERVAL 7 DAY)),
(11, 6, DATE_SUB(NOW(), INTERVAL 8 DAY)),
(12, 8, DATE_SUB(NOW(), INTERVAL 9 DAY)),
(13, 10, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(14, 12, DATE_SUB(NOW(), INTERVAL 11 DAY)),
(15, 14, DATE_SUB(NOW(), INTERVAL 12 DAY)),
(1, 17, DATE_SUB(NOW(), INTERVAL 3 DAY)),
(2, 18, DATE_SUB(NOW(), INTERVAL 4 DAY)),
(3, 19, DATE_SUB(NOW(), INTERVAL 5 DAY)),
(4, 20, DATE_SUB(NOW(), INTERVAL 6 DAY)),
(5, 1, DATE_SUB(NOW(), INTERVAL 7 DAY)),
(6, 2, DATE_SUB(NOW(), INTERVAL 8 DAY)),
(7, 3, DATE_SUB(NOW(), INTERVAL 9 DAY)),
(8, 4, DATE_SUB(NOW(), INTERVAL 10 DAY)),
(9, 5, DATE_SUB(NOW(), INTERVAL 11 DAY)),
(10, 6, DATE_SUB(NOW(), INTERVAL 12 DAY)),
(11, 7, DATE_SUB(NOW(), INTERVAL 13 DAY)),
(12, 8, DATE_SUB(NOW(), INTERVAL 14 DAY)),
(13, 9, DATE_SUB(NOW(), INTERVAL 15 DAY)),
(14, 10, DATE_SUB(NOW(), INTERVAL 16 DAY)),
(15, 11, DATE_SUB(NOW(), INTERVAL 17 DAY)),
(1, 12, DATE_SUB(NOW(), INTERVAL 18 DAY)),
(2, 13, DATE_SUB(NOW(), INTERVAL 19 DAY)),
(3, 14, DATE_SUB(NOW(), INTERVAL 20 DAY)),
(4, 15, DATE_SUB(NOW(), INTERVAL 21 DAY));