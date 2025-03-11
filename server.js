require('dotenv').config();
const express = require('express');
const { Pool } = require('pg');
const bodyParser = require('body-parser');
const path = require('path');
const multer = require('multer');

const app = express();
const port = 3000;

const pool = new Pool({
    user: process.env.DB_USER,
    host: process.env.DB_HOST,
    database: process.env.DB_NAME,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
});

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.urlencoded({ extended: true }));

app.get('/', async (req, res) => {
    try {
        const arboles = await pool.query(`
            SELECT a.id_arbol, e.nombre AS nombre_especie, s.nombre AS nombre_subespecie, 
                   z.alcaldia || ', ' || z.colonia AS nombre_zona, 
                   a.grosor_tronco, a.altura, a.angulo_inclinacion,
                   a.estado_raices, a.estado_follaje, a.ultima_inspeccion,
                   a.fotografia, a.observaciones, 
                   COALESCE(ex.nombre_completo, 'No asignado') AS nombre_experto
            FROM Arboles a
            JOIN Especies e ON a.id_especie = e.id_especie
            JOIN Subespecies s ON a.id_subespecie = s.id_subespecie
            JOIN Zonas z ON a.id_zona = z.id_zona
            LEFT JOIN Expertos ex ON a.id_experto = ex.id_experto
            ORDER BY a.id_arbol ASC;
        `);

        const especies = await pool.query('SELECT * FROM Especies ORDER BY nombre ASC');
        const subespecies = await pool.query('SELECT * FROM Subespecies ORDER BY nombre ASC');
        const zonas = await pool.query('SELECT * FROM Zonas ORDER BY alcaldia, colonia');
        const expertos = await pool.query('SELECT * FROM Expertos ORDER BY nombre_completo ASC');

        res.render('arbol', {
            arboles: arboles.rows,
            especies: especies.rows,
            subespecies: subespecies.rows,
            zonas: zonas.rows,
            expertos: expertos.rows
        });
    } catch (error) {
        console.error('Error obteniendo datos:', error);
        res.status(500).send('Error al obtener los datos');
    }
});

app.post('/agregar', upload.single('fotografia'), async (req, res) => {
    const {
        id_especie, id_subespecie, id_zona, grosor_tronco, altura, angulo_inclinacion,
        estado_raices, estado_follaje, ultima_inspeccion, observaciones, id_experto
    } = req.body;

    const fotografia = req.file ? `/uploads/${req.file.filename}` : null;

    if (grosor_tronco < 0 || altura < 0 || angulo_inclinacion < 0) {
        return res.status(400).send('Error: No se permiten valores negativos.');
    }

    try {
        await pool.query(
            `INSERT INTO Arboles (
                id_especie, id_subespecie, id_zona, grosor_tronco, altura, angulo_inclinacion,
                estado_raices, estado_follaje, ultima_inspeccion, fotografia, observaciones, id_experto
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`,
            [id_especie, id_subespecie, id_zona, grosor_tronco, altura, angulo_inclinacion,
            estado_raices, estado_follaje, ultima_inspeccion, fotografia, observaciones, id_experto]
        );
        res.redirect('/');
    } catch (error) {
        console.error('Error agregando árbol:', error);
        res.status(500).send('Error al agregar árbol');
    }
});

app.post('/eliminar', async (req, res) => {
    const { id_arbol } = req.body;
    try {
        await pool.query('DELETE FROM Arboles WHERE id_arbol = $1', [id_arbol]);
        res.redirect('/');
    } catch (error) {
        console.error('Error eliminando árbol:', error);
        res.status(500).send('Error al eliminar árbol');
    }
});

app.post('/actualizar', async (req, res) => {
    const { id_arbol, grosor_tronco, altura, angulo_inclinacion } = req.body;

    if (grosor_tronco < 0 || altura < 0 || angulo_inclinacion < 0) {
        return res.status(400).send('Error: No se permiten valores negativos.');
    }

    try {
        await pool.query(
            `UPDATE Arboles 
             SET grosor_tronco = $1, altura = $2, angulo_inclinacion = $3 
             WHERE id_arbol = $4`,
            [grosor_tronco, altura, angulo_inclinacion, id_arbol]
        );
        res.redirect('/');
    } catch (error) {
        console.error('Error actualizando árbol:', error);
        res.status(500).send('Error al actualizar árbol');
    }
});

app.listen(port, () => {
    console.log(`Servidor corriendo en http://localhost:${port}`);
});
