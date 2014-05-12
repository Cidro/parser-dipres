SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

CREATE TABLE IF NOT EXISTS `capitulos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `partida_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  KEY `capitulos_partida_id_foreign` (`partida_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=205 ;

CREATE TABLE IF NOT EXISTS `clasificaciones_economicas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `titulo` varchar(8) NOT NULL,
  `subtitulo` varchar(8) NOT NULL,
  `item` varchar(8) NOT NULL,
  `asignacion` varchar(8) NOT NULL,
  `nombre` varchar(255) NOT NULL,
  PRIMARY KEY (`id`),
  KEY `clasificaciones_economicas_titulo_index` (`titulo`),
  KEY `clasificaciones_economicas_subtitulo_index` (`subtitulo`),
  KEY `clasificaciones_economicas_item_index` (`item`),
  KEY `clasificaciones_economicas_asignacion_index` (`asignacion`),
  KEY `clasificaciones_economicas_nombre_index` (`nombre`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=1991 ;

CREATE TABLE IF NOT EXISTS `ejecuciones` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `moneda` varchar(3) NOT NULL,
  `monto` double NOT NULL,
  `formulado` double NOT NULL,
  `vigente` double NOT NULL,
  `programa_id` int(10) unsigned NOT NULL,
  `periodo_id` int(10) unsigned DEFAULT NULL,
  `clasificacion_economica_id` int(10) unsigned DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  KEY `ejecuciones_programa_id_foreign` (`programa_id`),
  KEY `ejecuciones_periodo_id_foreign` (`periodo_id`),
  KEY `ejecuciones_clasificacion_economica_id_foreign` (`clasificacion_economica_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=30933 ;

CREATE TABLE IF NOT EXISTS `partidas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=27 ;

CREATE TABLE IF NOT EXISTS `periodos` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `mes` int(11) NOT NULL,
  `ano` int(11) NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=4 ;

CREATE TABLE IF NOT EXISTS `programas` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `nombre` varchar(255) NOT NULL,
  `capitulo_id` int(10) unsigned NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  `updated_at` timestamp NOT NULL DEFAULT '0000-00-00 00:00:00',
  PRIMARY KEY (`id`),
  KEY `programas_capitulo_id_foreign` (`capitulo_id`)
) ENGINE=InnoDB  DEFAULT CHARSET=utf8 AUTO_INCREMENT=314 ;

ALTER TABLE `capitulos`
  ADD CONSTRAINT `capitulos_partida_id_foreign` FOREIGN KEY (`partida_id`) REFERENCES `partidas` (`id`) ON DELETE CASCADE;

ALTER TABLE `ejecuciones`
  ADD CONSTRAINT `ejecuciones_clasificacion_economica_id_foreign` FOREIGN KEY (`clasificacion_economica_id`) REFERENCES `clasificaciones_economicas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `ejecuciones_periodo_id_foreign` FOREIGN KEY (`periodo_id`) REFERENCES `periodos` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `ejecuciones_programa_id_foreign` FOREIGN KEY (`programa_id`) REFERENCES `programas` (`id`) ON DELETE CASCADE;

ALTER TABLE `programas`
  ADD CONSTRAINT `programas_capitulo_id_foreign` FOREIGN KEY (`capitulo_id`) REFERENCES `capitulos` (`id`) ON DELETE CASCADE;