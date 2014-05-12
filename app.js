var colors = require('colors'),
    request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    Q = require('q'),
    mysql = require('mysql'),
    parseString = require('xml2js').parseString,
    Iconv = require('iconv').Iconv,
    crypto = require('crypto'),
    args = require('minimist')(process.argv.slice(2))
    db_config = require('./database');

var conn = mysql.createConnection(db_config);

//Arreglo para normalizar los meses
var meses = {'1':'3', '2':'6', '3':'9', '4':'12', '-1':'1', '-2':'2', '-4':'4', '-5':'5', '-7':'7', '-8':'8', '-10':'10', '-11':'11', '17':'7', '18':'8'};

var content_url_anos = {
        '2011' : 'http://www.dipres.gob.cl/595/w3-multipropertyvalues-15460-20971.html',
        '2012' : 'http://www.dipres.gob.cl/595/w3-multipropertyvalues-15460-21327.html',
        '2013' : 'http://www.dipres.gob.cl/595/w3-multipropertyvalues-15460-21672.html',
        '2014' : 'http://www.dipres.gob.cl/595/w3-multipropertyvalues-15460-22027.html'
    };

var ano = args.y || 2013,
    content_url = content_url_anos[ano],
    remote_files_base_url = 'http://www.dipres.gob.cl/595/',
    local_files_path = "./files/" + ano + "/",
    total_archivos = 0,
    cont_archivos_parseados = 0
    inicio_parseo = new Date();

var periodos = [],
    clasificaciones_economicas = [];

console.log(("Se comienza el parseo del año: " + ano + " en la url: " + content_url).green);

request({uri: content_url, encoding : 'binary'}, function (error, response, body) {
    $ = cheerio.load(body);

    var tags_archivos_xml = $("a[href$='.xml']");
    
    total_archivos = tags_archivos_xml.length;

    Q.when(descarga_archivos_xml(tags_archivos_xml)).then(function () {
        var titulos_partidas = $('#recuadros_colapsables>h3');
        carga_contenidos(titulos_partidas);
    });
});

function descarga_archivos_xml (tags_archivos_xml) {
    var archivos_descargados = 0
        def = new Q.defer();

    tags_archivos_xml.each(function (i, e) {
        var file_name = e.attribs.href,
            file_url = remote_files_base_url + file_name,
            file_def = new Q.defer();

        if(fs.existsSync(local_files_path + file_name)){
            file_def.resolve('existe');
        } else {
            request({uri : file_url, encoding : 'binary'}, function(file_name, error, response, body){

                if(error || response.statusCode != 200){

                    file_def.resolve('error');

                } else {

                    body = normalizeText(body);
                    fs.writeFile(local_files_path + file_name, body, function (err) {
                        if(!err){
                            file_def.resolve('descarga');
                        } else {
                            file_def.resolve('error');
                        }
                    });

                }

            }.bind(null, file_name));
        }

        file_def.promise.then(function (file_name, result) {
            var msg = '';
            archivos_descargados++;

            switch(result){
                case 'error':
                    msg = 'Error descargando el archivo '.red + file_name.red.blue;
                    break;
                case 'existe':
                    msg = 'El archivo '.blue + file_name.red +' fué descargado previamente. Se omite su descarga.'.blue;
                    break;
                case 'descarga':
                    msg = 'archivo '.green + file_name.red + ' descargado correctamente.'.green;
                    break;
            }

            console.log(msg + ' [' + archivos_descargados + ' - ' + total_archivos + ']');

            if(archivos_descargados == total_archivos)
                def.resolve();
        }.bind(null, file_name));
    });

    return def.promise;
}

function normalizeText (text) {
    var buf = new Buffer(text, 'binary'),
        conv = new Iconv('utf16le', 'utf8');

    return conv.convert(buf).toString();
}

function getHash (text) {
    return crypto.createHash('md5').update(text).digest('hex');
}

function carga_contenidos (titulos_partidas) {
    console.log(("Cantidad Partidas: " + titulos_partidas.length).red);
    //Se comienza recorriendo las partidas
    titulos_partidas.each(function (i, e) {
        var tag_partida = $(this),
            titulos_capitulos = tag_partida.next('.recuadros_colapsables').children('h3');

        crea_partida(tag_partida).then(recorre_capitulos.bind(null, titulos_capitulos));
    });
}

function crea_partida (tag_partida) {
    var final_def = new Q.defer(),
        query_def = new Q.defer(),
        nombre = tag_partida.text(),
        sql_query = "SELECT * FROM partidas WHERE nombre = ?",
        sql_insert = "INSERT INTO partidas (nombre, created_at, updated_at) VALUES (?, NOW(), NOW());";

    conn.query(sql_query, [nombre], function (err, row) {
        console.log(err, row);
        if(row.length){
            final_def.resolve(row[0].id);
            query_def.resolve(false);
        } else {
            query_def.resolve(true);
        }
    });

    query_def.promise.then(function (crear_partida) {
        if(crear_partida){
            conn.query(sql_insert, [nombre], function (err, row) {
                console.log(("Se crea partida [" + nombre + "]").blue);
                final_def.resolve(row.insertId);
            });
        }
    });

    return final_def.promise;
}

function recorre_capitulos(titulos_capitulos, partida_id) {
    console.log(("Partida " + partida_id + " tiene " + titulos_capitulos.length + " capitulos").red);
    //Se continua con los capitulos
    titulos_capitulos.each(function (i, e) {
        var tag_capitulo = $(this),
            titulos_programas = tag_capitulo.next('.recuadros_colapsables').children('h3');

        crea_capitulo(tag_capitulo, partida_id).then(recorre_programas.bind(null, titulos_programas));
    });
}

function crea_capitulo (tag_capitulo, partida_id) {
    var final_def = new Q.defer(),
        query_def = new Q.defer(),
        nombre = tag_capitulo.text(),
        sql_query = "SELECT * FROM capitulos WHERE nombre = ? AND partida_id = ?",
        sql_insert = "INSERT INTO capitulos (nombre, partida_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW());";

    conn.query(sql_query, [nombre, partida_id], function (err, row) {
        if(row.length){
            final_def.resolve(row[0].id);
            query_def.resolve(false);
        } else {
            query_def.resolve(true);
        }
    });

    query_def.promise.then(function (crear_capitulo) {
        if(crear_capitulo){
            conn.query(sql_insert, [nombre, partida_id], function (err, row) {
                console.log(("Se crea capítulo [" + nombre + "]").green);
                final_def.resolve(row.insertId);
            });
        }
    }) 

    return final_def.promise;
}

function recorre_programas (titulos_programas, capitulo_id) {
    console.log(("Capitulo " + capitulo_id + " tiene " + titulos_programas.length + " programas").red);
    //Se continua con los programas
    titulos_programas.each(function (i, e) {
        var tag_programa = $(this),
            archivos_programas = tag_programa.next('.recuadros_colapsables').find("a[href$='.xml']");

        crea_programa(tag_programa, capitulo_id).then(recorre_archivos_ejecuciones.bind(null, archivos_programas));
    });
}

function crea_programa (tag_programa, capitulo_id) {
    var final_def = new Q.defer(),
        query_def = new Q.defer(),
        nombre = tag_programa.text(),
        sql_query = "SELECT * FROM programas WHERE nombre = ? AND capitulo_id = ?",
        sql_insert = "INSERT INTO programas (nombre, capitulo_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW());";

    conn.query(sql_query, [nombre, capitulo_id], function (err, row) {
        if(row.length){
            final_def.resolve(row[0].id);
            query_def.resolve(false);
        } else {
            query_def.resolve(true);
        }
    })

    query_def.promise.then(function (crear_programa) {
        if(crear_programa){
            conn.query(sql_insert, [nombre, capitulo_id], function (err, row) {
                console.log(("Se crea programa [" + nombre + "]").cyan);
                final_def.resolve(row.insertId);
            });
        }
    })

    return final_def.promise;
}

function recorre_archivos_ejecuciones (archivos_programas, programa_id) {
    console.log(("Programa " + programa_id + " tiene " + archivos_programas.length + " archivos para el periodo " + ano).red);
    archivos_programas.each(function (i, e) {
        var file_name = local_files_path + e.attribs.href,
            file_content = fs.readFileSync(file_name);

        parseString(file_content, function (err, data) {
            var cabecera = data.matriz.cabecera[0],
                hash_periodo = getHash(cabecera.periodo + meses[cabecera.semestre]);

            cabecera.programa_id = programa_id;

            if(!periodos[hash_periodo])
                periodos[hash_periodo] = crea_periodo(cabecera);

            periodos[hash_periodo].then(recorre_cuerpo_archivo.bind(null, cabecera));
        });

        cont_archivos_parseados++;
        console.log(("Parsenado archivo " + file_name + " ["+ cont_archivos_parseados +" - "+ total_archivos +"]").green);
    });
}

function crea_periodo (cabecera) {
    var final_def = new Q.defer(),
        query_def = new Q.defer(),
        periodo = cabecera.periodo,
        mes = meses[cabecera.semestre],
        sql = "SELECT * FROM periodos WHERE ano = ? AND mes = ?",
        sql_insert = "INSERT INTO periodos (ano, mes) VALUES (?, ?);";

    conn.query(sql, [ano, mes], function (err, row) {
        if(row.length){
            final_def.resolve(row[0].id);
            query_def.resolve(false);
        } else {
            query_def.resolve(true);
        }
    });

    query_def.promise.then(function(crear_periodo){
        if(crear_periodo){
            conn.query(sql_insert, [ano, mes], function (err, row) {
                console.log(("Se crea nuevo periodo: " + ano + "-" + mes).green);
                final_def.resolve(row.insertId);
            });
        }
    });

    return final_def.promise;
}

function recorre_cuerpo_archivo (cabecera, periodo_id) {
    cabecera.periodo_id = periodo_id;
    for(var i_cuerpo in cabecera.cuerpo){
        var cuerpo = cabecera.cuerpo[i_cuerpo],
            hash_caslif_econ = getHash(cuerpo.subtitulo + cuerpo.item + cuerpo.asignacion + cuerpo.nombre);

        var ejecucion = {
            moneda : (cabecera.moneda[0] == 'P' ? 'clp' : 'usd'),
            monto : cuerpo.monto[0],
            formulado : cuerpo.formulado[0],
            vigente : cuerpo.vigente[0],
            programa_id : cabecera.programa_id,
            periodo_id : cabecera.periodo_id,
            clasi_econ_id : null
        }

        if(!clasificaciones_economicas[hash_caslif_econ])
            clasificaciones_economicas[hash_caslif_econ] = crea_clasificacion_economica(cuerpo);

        clasificaciones_economicas[hash_caslif_econ].then(crea_ejecucion.bind(null, ejecucion));
    }
}

function crea_clasificacion_economica (cuerpo) {
    var final_def = new Q.defer(),
        query_def = new Q.defer(),
        titulo = cuerpo.subtitulo[0].substr(0,1),
        subtitulo = cuerpo.subtitulo[0],
        item = cuerpo.item[0],
        asignacion = cuerpo.asignacion[0],
        nombre = cuerpo.nombre[0],
        sql = "SELECT * FROM clasificaciones_economicas WHERE subtitulo = ? AND item = ? AND asignacion = ? AND nombre = ?",
        sql_insert = "INSERT INTO clasificaciones_economicas (titulo, subtitulo, item, asignacion, nombre) VALUES (?, ?, ?, ?, ?);";

    conn.query(sql, [subtitulo, item, asignacion, nombre], function (err, row) {
        if(row.length){
            final_def.resolve(row[0].id);
            query_def.resolve(false);
        } else {
            query_def.resolve(true);
        }
    });

    query_def.promise.then(function (crear_clasif_econ) {
        if(crear_clasif_econ){
            conn.query(sql_insert, [titulo, subtitulo, item, asignacion, nombre], function (err, row) {
                console.log(("Se crea nueva clasificacion económica: " + nombre).green);
                final_def.resolve(row.insertId);
            });
        }
    });

    return final_def.promise;
}

function crea_ejecucion (ejecucion, clasi_econ_id) {
    var sql = "INSERT INTO ejecuciones (moneda, monto, formulado, vigente, programa_id, periodo_id, clasificacion_economica_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW());";

    ejecucion.clasi_econ_id = clasi_econ_id;

    conn.query(sql, [ejecucion.moneda, ejecucion.monto, ejecucion.formulado, ejecucion.vigente, ejecucion.programa_id, ejecucion.periodo_id, ejecucion.clasi_econ_id], function (err, row) {
        if(err){
            console.log(err);
        } else {
            console.log("Ejecucion creada id: " + row.insertId + " ["+tiempo_parseo()+"]");
        }
    });
}

function tiempo_parseo () {
    return ((new Date() - inicio_parseo) / 1000) + "s";
}