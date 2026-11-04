"""Pruebas de llenar_libro.py. Se corren con: python -m unittest tools/test_llenar_libro.py"""
import csv
import sys
import tempfile
import unittest
from pathlib import Path

import openpyxl

sys.path.insert(0, str(Path(__file__).resolve().parent))
import llenar_libro as ll  # noqa: E402

RAIZ = Path(__file__).resolve().parent.parent
LIBRO = RAIZ / 'plantilla' / 'THUNDERS-Master_v1.6_plantillas_e_instrumentos.xlsx'


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
        self.dir = Path(tempfile.mkdtemp(prefix='tomatera-libro-'))
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
        self.dir = Path(tempfile.mkdtemp(prefix='tomatera-csv-'))

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

    def test_crea_los_seis_csv(self):
        nombres = ll.generar_csv(self.exportacion([mesa_base()]), str(self.dir))
        self.assertEqual(sorted(Path(n).name for n in nombres), sorted([
            'medicion.csv', 'rondas.csv', 'divergencias.csv', 'cuestionario.csv', 'celdas_por_requisito.csv', 'eventos.csv',
        ]))


if __name__ == '__main__':
    unittest.main()
