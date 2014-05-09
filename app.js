var colors = require('colors'),
    request = require('request'),
    cheerio = require('cheerio'),
    fs = require('fs'),
    Q = require('q'),
    mysql = require('mysql'),
    parseString = require('xml2js').parseString,
    Iconv = require('iconv').Iconv,
    crypto = require('crypto');;

var conn = mysql.createConnection({
  host     : 'localhost',
  user     : 'root',
  password : 'pch090384',
  database : 'parser_dipres'
});

var ano = '2013',
    content_url = 'http://localhost/dipres.html',
    remote_files_base_url = 'http://www.dipres.gob.cl/595/',
    local_files_path = "./files/" + ano + "/",
    total_archivos = 0,
    cont_archivos_parseados = 0
    inicio_parseo = new Date();

var periodos = [],
    clasificaciones_economicas = [];

request({uri: content_url, encoding : 'binary'}, function (error, response, body) {
    $ = cheerio.load(body);

    var tags_archivos_xml = $("a[href$='.xml']");
    
    total_archivos = tags_archivos_xml.length;

    // Q.when(descarga_archivos_xml(tags_archivos_xml)).then(function () {
        var titulos_partidas = $('#recuadros_colapsables>h3');
        carga_contenidos(titulos_partidas);
    // });
});

function descarga_archivos_xml (tags_archivos_xml) {
    var archivos_descargados = 0
        def = new Q.defer();

    tags_archivos_xml.each(function (i, e) {
        var file_name = e.attribs.href,
            file_url = remote_files_base_url + file_name;

        archivos_descargados++;

        if(fs.existsSync(local_files_path + file_name)){
            console.log('El archivo '.blue + file_name.red +' fué descargado previamente. Se omite su descarga.'.blue);
        } else {
            request({uri : file_url, encoding : 'binary'}, function(file_name, error, response, body){

                if(error || response.statusCode != 200){

                    console.log('Error descargando el archivo '.red + file_name.red.blue);

                } else {

                    body = normalizeText(body);
                    fs.writeFile(local_files_path + file_name, body, function (file_name, err) {
                        if(!err){
                            console.log('archivo '.green + file_name.red + ' descargado correctamente.'.green + ' [' + archivos_descargados + ' - ' + total_archivos + ']');
                        }
                    }.bind(null, file_name));

                }

            }.bind(null, file_name));
        }

        if(archivos_descargados == total_archivos)
            def.resolve();
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
        crea_partida($(this))
            .then(recorre_capitulos);
    });
}

function crea_partida (tag_partida) {
    var def = new Q.defer(),
        nombre = tag_partida.text(),
        sql = "INSERT INTO partidas (nombre, created_at, updated_at) VALUES (?, NOW(), NOW());";

    conn.query(sql, [nombre], function (err, row) {
        console.log(("Se crea partida [" + nombre + "]").blue);
        var titulos_capitulos = tag_partida.next('.recuadros_colapsables').children('h3');
        def.resolve({titulos_capitulos : titulos_capitulos, partida_id : row.insertId});
    });

    return def.promise;
}

function recorre_capitulos(result) {
    console.log(("Partida " + result.partida_id + " tiene " + result.titulos_capitulos.length + " capitulos").red);
    //Se continua con los capitulos
    result.titulos_capitulos.each(function (i, e) {
        crea_capitulo($(this), result.partida_id).then(recorre_programas);
    });
}

function crea_capitulo (tag_capitulo, partida_id) {
    var def = new Q.defer(),
        nombre = tag_capitulo.text(),
        sql = "INSERT INTO capitulos (nombre, partida_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW());";

    conn.query(sql, [nombre, partida_id], function (err, row) {
        console.log(("Se crea capítulo [" + nombre + "]").green);
        var titulos_programas = tag_capitulo.next('.recuadros_colapsables').children('h3');
        def.resolve({titulos_programas : titulos_programas, capitulo_id : row.insertId});
    });

    return def.promise;
}

function recorre_programas (result) {
    console.log(("Capitulo " + result.capitulo_id + " tiene " + result.titulos_programas.length + " programas").red);
    //Se continua con los programas
    result.titulos_programas.each(function (i, e) {
        crea_programa($(this), result.capitulo_id).then(recorre_archivos_ejecuciones);
    });
}

function crea_programa (tag_programa, capitulo_id) {
    var def = new Q.defer(),
        nombre = tag_programa.text(),
        sql = "INSERT INTO programas (nombre, capitulo_id, created_at, updated_at) VALUES (?, ?, NOW(), NOW());";

    conn.query(sql, [nombre, capitulo_id], function (err, row) {
        console.log(("Se crea programa [" + nombre + "]").cyan);
        var archivos_programas = tag_programa.next('.recuadros_colapsables').find("a[href$='.xml']");
        def.resolve({archivos_programas : archivos_programas, programa_id : row.insertId});
    });

    return def.promise;
}

function recorre_archivos_ejecuciones (result) {
    console.log(("Programa " + result.programa_id + " tiene " + result.archivos_programas.length + " archivos para el periodo " + ano).red);
    result.archivos_programas.each(function (i, e) {
        var file_name = local_files_path + e.attribs.href,
            file_content = fs.readFileSync(file_name);

        parseString(file_content, function (err, data) {
            var cabecera = data.matriz.cabecera[0],
                hash_periodo = getHash(cabecera.periodo + cabecera.semestre);

            cabecera.programa_id = result.programa_id;

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
        mes = cabecera.semestre,
        sql = "SELECT * FROM periodos WHERE ano = ? AND mes = ?",
        sql_insert = "INSERT INTO periodos (ano, mes) VALUES (?, ?);";

    conn.query(sql, [ano, mes], function (err, row) {
        if(row.length){
            final_def.resolve(row[0].id);
        } else {
            query_def.resolve(false);
        }
    });

    query_def.promise.then(function(){
        conn.query(sql_insert, [ano, mes], function (err, row) {
            console.log(("Se crea nuevo periodo: " + ano + "-" + mes).green);
            final_def.resolve(row.insertId);
        });
    });

    return final_def.promise;
}

function recorre_cuerpo_archivo (cabecera, periodo_id) {
    cabecera.periodo_id = periodo_id;
    for(var i_cuerpo in cabecera.cuerpo){
        var cuerpo = cabecera.cuerpo[i_cuerpo],
            hash_caslif_econ = getHash(cuerpo.subtitulo + cuerpo.item + cuerpo.asignacion + cuerpo.nombre);

        var ejecucion = {
            moneda : cabecera.moneda[0],
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
        } else {
            query_def.resolve(false);
        }
    });

    query_def.promise.then(function () {
        conn.query(sql_insert, [titulo, subtitulo, item, asignacion, nombre], function (err, row) {
            console.log(("Se crea nueva clasificacion económica: " + nombre).green);
            final_def.resolve(row.insertId);
        });
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