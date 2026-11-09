"""Pruebas de llenar_libro.py. Se corren con: python -m unittest tools/test_llenar_libro.py"""
import csv
import hashlib
import sys
import tempfile
import unittest
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
import llenar_libro as ll  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
LIBRO = RAIZ / 'plantilla' / 'THUNDERS-Master_v1.6_plantillas_e_instrumentos.xlsx'


def carpeta_temporal(prueba, prefijo):
    destino = RAIZ / 'tools' / 'salida'
    destino.mkdir(parents=True, exist_ok=True)
    temporal = tempfile.TemporaryDirectory(prefix=prefijo, dir=destino)
    prueba.addCleanup(temporal.cleanup)
    return Path(temporal.name)


def mesa_base(numero=1):
    """Una mesa vacía con la misma forma que la exportación."""
    return {
        'numero': numero, 'miembros': {},
        'apertura': {'versiones': {}, 'equivalencia': {}, 'ajustes': ''},
        'glosario': [], 'necesidades': [], 'tarjetas': [],
        'i2a': {}, 'i2b': {'obsB1': '', 'obsB2': ''}, 'i2c': {}, 'esperadosPorNecesidad': {},
        'planI3': [], 'rondas': [], 'chequeosBloque': {'obs': ''},
        'validacion06': {'conjunto': '', 'fechaParticipantes': '', 'tecnica': '', 'constancia': ''},
        'divergencias': [],
        'lineaBase': {'evidencias': {}}, 'traspaso': {'items': {}}, 'acciones': [], 'destape': {},
        'fichaPedidas': [], 'reabiertos': [],
    }


def termino(i, nombre, editado=''):
    return {'id': f'T-{i:02d}', 'termino': nombre, 'definicion': f'Definición de {nombre}', 'ejemplo': '',
            'critico': 'Sí', 'estado': 'Tentativo', 'responsable': '', 'editadoPor': editado}


def necesidad(i, texto, fuente='Paco Ruiz, asesor de huerto'):
    return {'id': f'N-{i:02d}', 'bloque': 1, 'necesidad': texto, 'fuente': fuente, 'contextoValor': '', 'supuestos': '',
            'prioridad': 'Alta', 'estado': 'Nueva', 'editadoPor': 'p1'}


def tarjeta(i, necesidad_id, enunciado, critico='Sí'):
    return {'id': f'R-{i:02d}', 'necesidadId': necesidad_id, 'tipo': 'Funcional', 'enunciado': enunciado, 'critico': critico,
            'criterioEjemplo': 'Avisa con menos de 30 %', 'prioridad': 'Alta', 'restriccion': '', 'acepta': '', 'editadoPor': 'p1'}


class LlenarMesa(unittest.TestCase):
    def setUp(self):
        self.dir = carpeta_temporal(self, 'tomatera-libro-')
        self.mesa = mesa_base()
        self.mesa['glosario'] = [termino(1, 'Guía'), termino(2, 'Plantel')]
        self.mesa['necesidades'] = [necesidad(1, 'Saber cuándo regar'), necesidad(2, 'Que cuide los tomates sola', 'Lucía Ferrer, dueña')]
        self.mesa['tarjetas'] = [tarjeta(1, 'N-01', 'Avisar cuando la tierra esté seca')]
        self.mesa['apertura'] = {
            'versiones': {'SD': {'texto': 'Versión de Paco'}, 'AN': {'texto': 'Versión del AN'}, 'PO': {'texto': 'Versión de Lucía'}},
            'equivalencia': {'SD': 'Sí', 'AN': 'Sí', 'PO': 'No'}, 'ajustes': 'Avisa y la persona riega',
        }
        self.salida = self.dir / 'mesa-01.xlsx'
        ll.llenar_mesa(str(LIBRO), self.mesa, str(self.salida))
        self.libro = openpyxl.load_workbook(self.salida)
        self.addCleanup(self.libro.close)

    def hoja(self, prefijo):
        return self.libro[next(n for n in self.libro.sheetnames if n.startswith(prefijo))]

    def test_no_pisa_formulas(self):
        self.assertTrue(str(self.hoja('03')['A16'].value).startswith('='))
        self.assertTrue(str(self.hoja('04')['A9'].value).startswith('='))

    def test_glosario_desde_fila_16(self):
        ws = self.hoja('03')
        self.assertEqual(ws['B16'].value, 'Guía')
        self.assertEqual(ws['B17'].value, 'Plantel')
        self.assertEqual(ws['C16'].value, 'Definición de Guía')

    def test_necesidades_desde_fila_9(self):
        ws = self.hoja('04')
        self.assertEqual(ws['C9'].value, 'Saber cuándo regar')
        self.assertEqual(ws['D10'].value, 'Lucía Ferrer, dueña')
        self.assertEqual(ws['G9'].value, 'Alta')
        self.assertEqual(self.hoja('05')['E9'].value, 'Avisar cuando la tierra esté seca')

    def test_apertura_filas_28_a_30(self):
        ws = self.hoja('01')
        self.assertIn('Versión de Paco', ws['B28'].value)
        self.assertIn('Versión del AN', ws['B29'].value)
        self.assertIn('Versión de Lucía', ws['B30'].value)
        self.assertEqual(ws['C30'].value, 'No')
        self.assertEqual(ws['C32'].value, 'Avisa y la persona riega')

    def test_ligereza_parametros(self):
        ws = self.hoja('Ligereza')
        self.assertEqual(ws['B9'].value, 2)
        self.assertEqual(ws['B10'].value, 2)
        self.assertEqual(ws['B11'].value, 1)
        self.assertEqual(ws['B12'].value, 1)
        self.assertTrue(str(ws['B18'].value).startswith('='))

    def test_conserva_las_siglas_de_la_plantilla_oficial(self):
        # El libro es el instrumento de la versión final y lo analizan los autores: sus siglas no se reescriben.
        self.assertEqual(self.hoja('Inicio')['D8'].value, 'FR (AN, PO)')
        self.assertTrue(self.hoja('01')['B29'].value.startswith('AN: «'))
        respuestas = ll._respuestas({'respuestas': {'guia': {'p1': 'Para el QA significa otra cosa'}}},
                                   {'id': 'guia'}, {'miembros': {'p1': ['FR', 'RT']}})
        self.assertEqual(respuestas, 'Respondieron FR+RT: «Para el QA significa otra cosa»')

    def test_el_rol_del_mapa_respeta_la_lista_desplegable(self):
        contenido = {'roles': {}, 'plantillas': {'mapa': [
            {'actor': 'Lucía Ferrer, dueña', 'rol': 'PO', 'aporta': 'Prioridades', 'haceLaTarea': '', 'decide': 'Sí', 'disponibilidad': 'Siempre'},
            {'actor': 'Facilitador de requisitos de Nodo Sur', 'rol': 'FR', 'aporta': 'Conduce', 'haceLaTarea': '', 'decide': 'No', 'disponibilidad': 'Siempre'},
        ]}}
        salida = self.dir / 'mapa.xlsx'
        ll.llenar_mesa(str(LIBRO), self.mesa, str(salida), contenido)
        wb = openpyxl.load_workbook(salida)
        try:
            ws = ll._hoja(wb, '02')
            self.assertEqual([ws['B9'].value, ws['B10'].value], ['PO', 'FR'])
            self.assertEqual(ws['A10'].value, 'Facilitador de requisitos de Nodo Sur')
        finally:
            wb.close()


class GlosarioAmpliado(unittest.TestCase):
    def setUp(self):
        self.dir = carpeta_temporal(self, 'tomatera-glosario-')

    def test_exporta_41_y_65_terminos_con_formulas_y_referencias_completas(self):
        original = hashlib.sha256(LIBRO.read_bytes()).hexdigest()
        plantilla = openpyxl.load_workbook(LIBRO)
        self.addCleanup(plantilla.close)
        glosario_original = ll._hoja(plantilla, '03')
        for cantidad in (41, 65):
            with self.subTest(cantidad=cantidad):
                mesa = mesa_base()
                mesa['glosario'] = [termino(i, f'Palabra {i}') for i in range(1, cantidad + 1)]
                mesa['divergencias'] = [{'id': 'D-01', 'afectaA': f'T-{cantidad:02d}', 'estado': 'Pendiente'}]
                salida = self.dir / f'glosario-{cantidad}.xlsx'
                ll.llenar_mesa(str(LIBRO), mesa, str(salida))
                wb = openpyxl.load_workbook(salida)
                try:
                    glosario = ll._hoja(wb, '03')
                    ultima = 15 + cantidad
                    evidencia = ultima + 2
                    self.assertEqual(glosario.max_row, evidencia)
                    for i in range(1, cantidad + 1):
                        fila = 15 + i
                        self.assertEqual(glosario[f'B{fila}'].value, f'Palabra {i}')
                        self.assertEqual(glosario[f'C{fila}'].value, f'Definición de Palabra {i}')
                        self.assertEqual(glosario[f'A{fila}'].value, f'=IF(B{fila}="","","T-"&TEXT(ROW()-15,"00"))')
                    self.assertEqual(glosario[f'B{ultima}']._style, glosario_original['B55']._style)
                    self.assertEqual(glosario.row_dimensions[evidencia].height, glosario_original.row_dimensions[57].height)
                    formula = glosario[f'C{evidencia}'].value
                    self.assertIn(f'E16:E{ultima}', formula)
                    self.assertIn(f'B16:B{ultima}', formula)
                    self.assertIn(f'F16:F{ultima}', formula)
                    self.assertIn(f'C{evidencia}:G{evidencia}', {str(r) for r in glosario.merged_cells.ranges})
                    validaciones = [str(v.sqref) for v in glosario.data_validations.dataValidation]
                    self.assertIn(f'E16:E{ultima}', validaciones)
                    self.assertIn(f'F16:F{ultima}', validaciones)
                    validacion = ll._hoja(wb, '06')
                    self.assertEqual(validacion['C18'].value, f'T-{cantidad:02d}')
                    self.assertIn(f"'03 Glosario'!$A$16:$A${ultima}", validacion['D18'].value)
                    self.assertIn(f"'03 Glosario'!$E$16:$E${ultima}", validacion['D47'].value)
                    linea_base = ll._hoja(wb, '07')
                    self.assertEqual(linea_base['D16'].value, f"='03 Glosario'!$C${evidencia}")
                    self.assertIn(f"'03 Glosario'!$B$16:$B${ultima}", linea_base['B10'].value)
                    self.assertEqual(ll._hoja(wb, '05')['C55'].value, ll._hoja(plantilla, '05')['C55'].value)
                    self.assertTrue(wb.calculation.fullCalcOnLoad)
                    self.assertTrue(wb.calculation.forceFullCalc)
                finally:
                    wb.close()
        self.assertEqual(hashlib.sha256(LIBRO.read_bytes()).hexdigest(), original)


class Escribir(unittest.TestCase):
    def test_no_escribe_sobre_una_formula(self):
        wb = openpyxl.Workbook()
        ws = wb.active
        ws['A1'] = '=1+1'
        self.assertFalse(ll.escribir(ws, 'A1', 'texto'))
        self.assertEqual(ws['A1'].value, '=1+1')
        self.assertTrue(ll.escribir(ws, 'B1', 'texto'))
        self.assertEqual(ws['B1'].value, 'texto')


class GenerarCsv(unittest.TestCase):
    def setUp(self):
        self.dir = carpeta_temporal(self, 'tomatera-csv-')

    def leer(self, nombre):
        with open(self.dir / nombre, encoding='utf-8-sig', newline='') as f:
            return list(csv.DictReader(f, delimiter=';'))

    def exportacion(self, mesas):
        return {
            'sesion': {'id': 's1', 'codigo': '123456'}, 'participantes': [{'id': 'p1', 'mesa': 1, 'roles': ['AN'], 'bot': False, 'espectador': False}],
            'mesas': mesas, 'medicion': {'p1': {'previa': ['a', '10', 'b', 'c'], 'posterior': ['x', '9', 'y', 'z']}},
            'cuestionario': {'p1': {'afirmaciones': [4, 4, 3, 2, 5], 'tlx': [50, 10, 60, 40, 55, 20], 'abierta': ''}},
            'entrevista': [], 'eventos': [{'seq': 1, 'en': 1800000000000, 'tipo': 'sesion.creada', 'por': {'tipo': 'autores'}, 'datos': {}}],
            'contenido': {'cuestionario': {'tlx': [{'id': x} for x in ('mental', 'fisica', 'temporal', 'rendimiento', 'esfuerzo', 'frustracion')]}},
        }

    def test_csv_medicion_tiene_previa_y_posterior(self):
        ll.generar_csv(self.exportacion([mesa_base()]), str(self.dir))
        filas = self.leer('medicion.csv')
        self.assertEqual(sorted(f['fase'] for f in filas), ['posterior', 'previa'])
        self.assertEqual(next(f for f in filas if f['fase'] == 'previa')['p2'], '10')

    def test_celdas_por_requisito(self):
        # 3 tarjetas × 6 campos, 3 necesidades × 5, 3 versiones y 3 marcas de equivalencia, los chequeos 5 y 6 y una evidencia: 42.
        m = mesa_base()
        m['tarjetas'] = [tarjeta(i, f'N-0{i}', f'Requisito {i}') for i in (1, 2, 3)]
        m['necesidades'] = [necesidad(i, f'Necesidad {i}') for i in (1, 2, 3)]
        m['apertura'] = {'versiones': {r: {'texto': 'v'} for r in ('PO', 'SD', 'AN')}, 'equivalencia': {r: 'Sí' for r in ('PO', 'SD', 'AN')}, 'ajustes': ''}
        m['chequeosBloque'] = {'c5': 'Sí', 'c6': 'Sí', 'obs': ''}
        m['lineaBase'] = {'evidencias': {'E1': {'resultado': 'Sí', 'nota': ''}}}
        self.assertEqual(ll.contar_campos(m)['total'], 42)
        ll.generar_csv(self.exportacion([m]), str(self.dir))
        fila = self.leer('celdas_por_requisito.csv')[0]
        self.assertEqual(fila['tarjetas'], '3')
        self.assertEqual(fila['campos'], '42')
        self.assertEqual(fila['por_requisito'], '14,0')

    def test_crea_los_siete_csv(self):
        nombres = ll.generar_csv(self.exportacion([mesa_base()]), str(self.dir))
        self.assertEqual(sorted(Path(n).name for n in nombres), sorted([
            'medicion.csv', 'rondas.csv', 'divergencias.csv', 'glosario.csv', 'cuestionario.csv', 'celdas_por_requisito.csv', 'eventos.csv',
        ]))

    def test_csv_glosario_conserva_todos_los_terminos(self):
        mesa = mesa_base()
        mesa['glosario'] = [termino(i, f'Palabra {i}', 'p1') for i in range(1, 66)]
        ll.generar_csv(self.exportacion([mesa]), str(self.dir))
        filas = self.leer('glosario.csv')
        self.assertEqual(len(filas), 65)
        self.assertEqual(filas[-1]['id'], 'T-65')
        self.assertEqual(filas[-1]['definicion'], 'Definición de Palabra 65')
        self.assertEqual(filas[-1]['editado_por'], 'p1')

    def test_csv_cuestionario_anexa_utilidad_preserva_columnas_y_ceros_tlx(self):
        exportacion = self.exportacion([mesa_base()])
        ids = ['problema', 'terminos', 'diferencias', 'requisitos', 'general']
        exportacion['contenido']['cuestionario']['utilidad'] = {'items': [{'id': i, 'texto': i} for i in ids], 'abierta': '¿Qué ayudó?'}
        r = exportacion['cuestionario']['p1']
        r['tlx'] = [0, 10, 0, 100, 55, 0]
        r['abierta'] = 'Comentario anterior'
        r['utilidad'] = {'respuestas': {'problema': 5, 'terminos': 4, 'diferencias': 2, 'requisitos': 3, 'general': 4}, 'abierta': 'Encontramos dos interpretaciones'}
        ll.generar_csv(exportacion, str(self.dir))
        fila = self.leer('cuestionario.csv')[0]
        self.assertEqual(list(fila), [
            'participante', 'mesa', 'roles', 'a1', 'a2', 'a3', 'a4', 'a5',
            'tlx_mental', 'tlx_fisica', 'tlx_temporal', 'tlx_rendimiento', 'tlx_esfuerzo', 'tlx_frustracion', 'abierta',
            'utilidad_problema', 'utilidad_terminos', 'utilidad_diferencias', 'utilidad_requisitos', 'utilidad_general', 'utilidad_abierta',
        ])
        self.assertEqual(fila['roles'], 'AN')
        self.assertEqual(fila['a5'], '5')
        self.assertEqual(fila['tlx_mental'], '0')
        self.assertEqual(fila['tlx_frustracion'], '0')
        self.assertEqual(fila['abierta'], 'Comentario anterior')
        self.assertEqual([fila[f'utilidad_{i}'] for i in ids], ['5', '4', '2', '3', '4'])
        self.assertEqual(fila['utilidad_abierta'], 'Encontramos dos interpretaciones')

    def test_cuestionario_sin_utilidad_no_agrega_columnas_ni_reordena(self):
        ll.generar_csv(self.exportacion([mesa_base()]), str(self.dir))
        fila = self.leer('cuestionario.csv')[0]
        self.assertEqual(fila['a3'], '3')
        self.assertEqual(fila['tlx_rendimiento'], '40')
        self.assertFalse([c for c in fila if c.startswith('utilidad')])

    def test_csv_medicion_dice_si_la_previa_se_respondio_con_la_carta(self):
        exportacion = self.exportacion([mesa_base()])
        exportacion['contenido']['protocolo'] = {'version': 2, 'cartaEnPrevia': True}
        ll.generar_csv(exportacion, str(self.dir))
        filas = {f['fase']: f for f in self.leer('medicion.csv')}
        self.assertEqual(filas['previa']['con_carta'], 'Sí')
        self.assertEqual(filas['posterior']['con_carta'], 'No')
        ll.generar_csv(self.exportacion([mesa_base()]), str(self.dir))
        self.assertEqual({f['con_carta'] for f in self.leer('medicion.csv')}, {'No'})

    def test_respuestas_faltantes_no_desplazan_las_columnas(self):
        exportacion = self.exportacion([mesa_base()])
        exportacion['cuestionario']['p1'] = {'afirmaciones': [4], 'tlx': [0], 'abierta': 'Sin datos completos'}
        ll.generar_csv(exportacion, str(self.dir))
        fila = self.leer('cuestionario.csv')[0]
        self.assertEqual(fila['a1'], '4')
        self.assertEqual(fila['a2'], '')
        self.assertEqual(fila['tlx_mental'], '0')
        self.assertEqual(fila['tlx_fisica'], '')
        self.assertEqual(fila['abierta'], 'Sin datos completos')


if __name__ == '__main__':
    unittest.main()
