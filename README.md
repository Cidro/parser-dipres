### Parser para obtener los datos del sitio de la Dirección de Presupuestos del Gobierno de Chile

##### Instalación

* Ejecutar "npm install" desde la ruta donde fue clonado el repo
* Crear una base de datos con la estructura del archivo "schema.sql"
* Copiar el archivo "database.sample.js" a "database.js" y modificarlo con los datos de acceso a la base de datos

#### Parser Informe Ejecución programas

El parser a nivel de programas se ejecuta utilizando el archivo "ejecuciones_programa.js".

```
node ejecuciones_programa.js -y [año]
```

#### Parser Informes desagregados de Presupuestos

El parser para el Informe desagregado de presupuestos se ejecuta utilizando el archivo "desagregado.js".

```
node desagregado.js -y [año]
```