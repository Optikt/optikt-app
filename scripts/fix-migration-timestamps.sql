-- One-off repair: __drizzle_migrations.created_at held hand-written FUTURE timestamps
-- from the journal (0036/0037/0038), which made drizzle-orm migrate() skip every
-- migration with an older `when` (silently). This matches each recorded row by the
-- sha256 of its migration file and resets created_at to the (now real) journal `when`.
--
-- Idempotent: running twice changes nothing. Safe on prod, docker, or any restored dump.
-- Run on the target database, then restart/redeploy the app so bootstrap.js applies
-- any pending migrations (0038, 0039, ...).

UPDATE drizzle.__drizzle_migrations SET created_at = 1776877114012 WHERE hash = '1c0381d120465a431e8cf4d1927650e094c2572f4e654e284d8639f51964f71f';
UPDATE drizzle.__drizzle_migrations SET created_at = 1776975187074 WHERE hash = '0892b5ba361b4bbc512b90036c41782bcfd48b334a46b2afd9388f112266e419';
UPDATE drizzle.__drizzle_migrations SET created_at = 1776969000000 WHERE hash = '0093431b1d16d9bb01ae0d83957108d73bb0b62a37fd07d9c93b56b3e9cffa2c';
UPDATE drizzle.__drizzle_migrations SET created_at = 1745527623000 WHERE hash = '83af79b1e9df46a72e1411f0d685972b4149335b42c6566cc4136397994308b6';
UPDATE drizzle.__drizzle_migrations SET created_at = 1777075200000 WHERE hash = '02ba1bb39a4962a5a299c8bd2af239beba9b43ffd8a4fc1bd40f149aef6f2bd8';
UPDATE drizzle.__drizzle_migrations SET created_at = 1777161600000 WHERE hash = 'd872445867a97065056c18c05da1129eb4b7e05f828fcedf22230fa36feec5c1';
UPDATE drizzle.__drizzle_migrations SET created_at = 1777420800000 WHERE hash = 'd7b9e0b22f6320467f16bfbe8e2bc8b41045ecff396f7ad1cca1b336285b070d';
UPDATE drizzle.__drizzle_migrations SET created_at = 1777610396499 WHERE hash = '65eec1c57b7976d462466f55533c34536583466d29f25eed802d50103f9dcff8';
UPDATE drizzle.__drizzle_migrations SET created_at = 1777700000000 WHERE hash = 'c3347cd69787d07135125f6e6f3295428b65d8845a86b4ce233d23301f2c3963';
UPDATE drizzle.__drizzle_migrations SET created_at = 1777760336170 WHERE hash = '01dd94f99bb7c9075781ac7366aa16f1cc84f427c042a8f5c36c4d1342e56f63';
UPDATE drizzle.__drizzle_migrations SET created_at = 1777833701367 WHERE hash = '7535467adfc3b38a2435d7a26531d94924291a7d9ecdf3eba5570ab2d3d2996c';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778001519264 WHERE hash = '82d1c0ae320469860076eb480644fdfa4ff80a76821da0fba52dbc40295f1615';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778162015994 WHERE hash = '4e1a921082de38084959c8d94d0fde6685e0322e56fbd4d9fba41014f6b01d1d';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778172571977 WHERE hash = '39863f6398a77ed725c540da25b244b50eb2cc63789d64c44c56518d57036fbc';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778345871760 WHERE hash = '72c2ee718ab3bc50e7057c913ef85a4d01f4123553b51704206e9a9ebbf1b268';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778550473569 WHERE hash = '2db228ed37f2e418320e5f43f901b0cb721a438749e24a06e6e5a6db355418f0';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778617926915 WHERE hash = '1672f74989258f5286118be63ef22a41d45d187731010a7ec160ead7a928b4f9';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778691924979 WHERE hash = 'd81cfd92b92248046f491162a3c5adbe5ed3184db6231793c66a78adcdcef89b';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778773445754 WHERE hash = 'fa0b8450095c6c489c09169c256b5766c3707f42fc9db0fb1f0e9974aa21927a';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778775327891 WHERE hash = '27d03a20efdeb87d0a3eaac31274af0cdc5904b95927b5e56ddf6465d36a7f2a';
UPDATE drizzle.__drizzle_migrations SET created_at = 1778897388643 WHERE hash = 'eeb3d0d2830f78b5d11de9ba0eb24c332038c8939fc22050c5e7dec24dafd7ce';
UPDATE drizzle.__drizzle_migrations SET created_at = 1779112077840 WHERE hash = '482e6cd1e18ef01118785f4ed8384d7b28a25ef7f5054a9951b489f5f312c01a';
UPDATE drizzle.__drizzle_migrations SET created_at = 1779373560169 WHERE hash = '1c7f3f96aaf9c03f786c189e45ff2a3121743ded05e1fb608a0b1ac4ad0b7e6c';
UPDATE drizzle.__drizzle_migrations SET created_at = 1779975765680 WHERE hash = 'e11ba3d52e79df22a07ab20e6d299622fb852e7ecb196594c7ede6b513eb74ba';
UPDATE drizzle.__drizzle_migrations SET created_at = 1780327597140 WHERE hash = '9173d88c2d54d97a30e731844893a91a11cc344d94af05302374243d77e99812';
UPDATE drizzle.__drizzle_migrations SET created_at = 1780434888016 WHERE hash = '4d104369d2ef01a2d85607b0866b1864cf835bac2b43f19eb3bec9b3f9dfcce6';
UPDATE drizzle.__drizzle_migrations SET created_at = 1780764152078 WHERE hash = '15920ff902b36363259efffd0052e04d253d24ae05399d53f871d7cf0d42efe1';
UPDATE drizzle.__drizzle_migrations SET created_at = 1780958400000 WHERE hash = '0af46fd6c50f6ba83c38f0bd89200de806e0b5baa7966e7d038c73365cc63ebd';
UPDATE drizzle.__drizzle_migrations SET created_at = 1781192907836 WHERE hash = '8b7784391cbe2920f345a8edccdc1bbac32e06e69a4c787505ba898f64b90c5e';
UPDATE drizzle.__drizzle_migrations SET created_at = 1781274774067 WHERE hash = 'de895783fdc511c7651da115114bf980ef212c8e2385d1dce407e5838c7661b0';
UPDATE drizzle.__drizzle_migrations SET created_at = 1781358267198 WHERE hash = '10c000f3a3200564f25bd0adeee76dfab91717118dc316170ed9f8afddf43b92';
UPDATE drizzle.__drizzle_migrations SET created_at = 1784159252000 WHERE hash = '136ad0e6bb3c9e65f120141caa1ccf74902a5c5961b3305c74c43c9c13480698';
UPDATE drizzle.__drizzle_migrations SET created_at = 1784571208000 WHERE hash = '0e09c6b6622f1772fbc78a4237d8a47570b705d0d9e4f676b02bd2670d24dc0c';
UPDATE drizzle.__drizzle_migrations SET created_at = 1785364800000 WHERE hash = 'b60ff098f1e55c8e9711b96890f96cc1c682b8d8a0764eca117012b1f54e30cb';
UPDATE drizzle.__drizzle_migrations SET created_at = 1785960000000 WHERE hash = 'a5dfc0afdebebff6357f8a64e37f306d26229eb5af2823d1227a9f447f17cb7b';
UPDATE drizzle.__drizzle_migrations SET created_at = 1786572000000 WHERE hash = 'c20be86032e81bf1e4d03f61ae8e0828f2cc9edd48ea0961df2048ffcce3e698';
UPDATE drizzle.__drizzle_migrations SET created_at = 1786622400000 WHERE hash = '34ad1582a4e891ae3ac9abb653f37afe09f535cf087172ce4708ab5fc92a3e7b';
UPDATE drizzle.__drizzle_migrations SET created_at = 1786694400000 WHERE hash = '218d0774b31f60a98fcd4571b8c6b7e990a8d8443384242926cf75687c178a5f';
UPDATE drizzle.__drizzle_migrations SET created_at = 1786705200000 WHERE hash = 'dedf8ccb3b65d2cae63de66c1bed7191ac6f78937ecd9d6ea30780b024495d2c';
UPDATE drizzle.__drizzle_migrations SET created_at = 1786726161170 WHERE hash = '38645df2ca30033bd5025681a211b5ba72958b4cbf682235438d40be616de92a';
