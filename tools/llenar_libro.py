"""Llena, por mesa, una copia del libro de la versión final con la exportación de Tomatera, y crea los CSV.

Uso: python tools/llenar_libro.py exportacion.json salida/ [--libro ruta/al/libro.xlsx]

Solo escribe en las celdas de entrada: nunca en una celda cuya fórmula empiece con «=», y se salta las filas de
ejemplo del libro. Al abrir cada libro en Excel, las fórmulas de E1 a E5 se recalculan. openpyxl descarta las listas
desplegables que dependen de otras hojas, pero los valores y las fórmulas se conservan.
"""
import argparse
import csv
import json
import re
import sys
import warnings
from copy import copy
from datetime import datetime, timezone
from pathlib import Path

import openpyxl
from openpyxl.cell.cell import MergedCell
from openpyxl.formula.tokenizer import Tokenizer
from openpyxl.formula.translate import Translator
from openpyxl.worksheet.cell_range import CellRange, MultiCellRange

RAIZ = Path(__file__).resolve().parent.parent
LIBRO = RAIZ / 'plantilla' / 'THUNDERS-Master_v1.6_plantillas_e_instrumentos.xlsx'
EVIDENCIAS = ['E1', 'E2', 'E3', 'E4', 'E5']

# openpyxl avisa que no conserva una extensión de las listas desplegables; ya está dicho arriba.
warnings.filterwarnings('ignore', message='Data Validation extension is not supported')


def escribir(ws, celda, valor) -> bool:
    """Escribe el valor si la celda es de entrada. No pisa fórmulas ni celdas combinadas; no escribe vacíos."""
    if valor is None or valor == '':
        return False
    c = ws[celda]
    if isinstance(c, MergedCell):
        return False
    if isinstance(c.value, str) and c.value.startswith('='):
        return False
    c.value = valor
    return True


def _hoja(wb, prefijo):
    return wb[next(n for n in wb.sheetnames if n.startswith(prefijo))]


def _fecha(ms):
    # Hora UTC sin zona, porque Excel no guarda la zona horaria.
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).replace(tzinfo=None)


def _nombre(roles, rol):
    # El libro es el instrumento de la versión final y usa las siglas de sus roles.
    nombre = (roles.get(rol) or {}).get('nombre')
    return f'{nombre} ({rol})' if nombre else rol


def _ampliar_glosario(wb, cantidad):
    """Amplía la copia del libro y sus referencias; insert_rows no actualiza fórmulas ni combinaciones."""
    extra = max(0, cantidad - 40)
    if not extra:
        return
    ws = _hoja(wb, '03')
    combinadas = [CellRange(str(r)) for r in ws.merged_cells.ranges if r.min_row >= 56]
    for rango in combinadas:
        ws.unmerge_cells(str(rango))
    dimensiones = {n: copy(d) for n, d in ws.row_dimensions.items() if n >= 56}
    for n in dimensiones:
        del ws.row_dimensions[n]
    ws.insert_rows(56, extra)
    for n, dimension in dimensiones.items():
        dimension.index = n + extra
        ws.row_dimensions[n + extra] = dimension
    for rango in combinadas:
        rango.shift(row_shift=extra)
        ws.merge_cells(str(rango))

    def ampliar_rango(referencia):
        coincidencia = re.fullmatch(r'(\$?[A-Z]{1,3}\$?)(\d+)(?::(\$?[A-Z]{1,3}\$?)(\d+))?', referencia)
        if not coincidencia:
            return referencia
        columna, inicio, columna_fin, fin = coincidencia.groups()
        inicio = int(inicio)
        nuevo_inicio = inicio + extra if inicio >= 56 else inicio
        if fin is None:
            return f'{columna}{nuevo_inicio}'
        fin = int(fin)
        nuevo_fin = fin + extra if fin >= 56 or (inicio == 16 and fin == 55) else fin
        return f'{columna}{nuevo_inicio}:{columna_fin}{nuevo_fin}'

    for hoja in wb:
        for fila in hoja:
            for celda in fila:
                if celda.data_type != 'f':
                    continue
                tokens = Tokenizer(celda.value).items
                for token in tokens:
                    if token.type != 'OPERAND' or token.subtype != 'RANGE':
                        continue
                    if '!' in token.value:
                        nombre, referencia = token.value.rsplit('!', 1)
                        if nombre.strip("'").replace("''", "'") == ws.title:
                            token.value = nombre + '!' + ampliar_rango(referencia)
                    elif hoja == ws:
                        token.value = ampliar_rango(token.value)
                celda.value = '=' + ''.join(token.value for token in tokens)
    for validacion in ws.data_validations.dataValidation:
        validacion.sqref = MultiCellRange(' '.join(ampliar_rango(str(r)) for r in validacion.sqref.ranges))
    # Las fórmulas nuevas ya apuntan a sus filas finales y no se deben desplazar otra vez.
    for fila in range(56, 56 + extra):
        for col in range(1, ws.max_column + 1):
            origen, destino = ws.cell(55, col), ws.cell(fila, col)
            destino._style = copy(origen._style)
            destino.number_format = origen.number_format
            destino.protection = copy(origen.protection)
            destino.alignment = copy(origen.alignment)
            if origen.data_type == 'f':
                destino.value = Translator(origen.value, origin=origen.coordinate).translate_formula(destino.coordinate)
    ws.print_area = f'A1:G{ws.max_row}'


def _llenos(d, claves):
    return sum(1 for k in claves if (d or {}).get(k) not in (None, ''))


def _criticas(mesa):
    return [t for t in mesa.get('tarjetas', []) if t.get('critico') == 'Sí']


def _items_i3(mesa):
    return [(r, it) for r in mesa.get('rondas', []) for it in r.get('items', [])]


def _respuestas(r, it, mesa):
    respuestas = (r.get('respuestas') or {}).get(it['id'], {})
    partes = [f"{'+'.join(mesa.get('miembros', {}).get(pid, [])) or 'sin rol'}: «{texto}»" for pid, texto in respuestas.items()]
    return 'Respondieron ' + '; '.join(partes) if partes else ''


def parametros_ligereza(mesa, contenido=None):
    """Los once parámetros de la hoja Ligereza (B7 a B17), con los conteos reales de la mesa."""
    contenido = contenido or {}
    micro = sum(1 for r, it in _items_i3(mesa) if it['id'] in (r.get('resultados') or {}))
    bloques = max([n.get('bloque') or 1 for n in mesa.get('necesidades', [])] or [1])
    pendientes = sum(1 for d in mesa.get('divergencias', []) if d.get('estado') != 'Resuelta y confirmada')
    return [
        len((contenido.get('plantillas') or {}).get('mapa', [])),
        len(mesa.get('apertura', {}).get('versiones', {})),
        len(mesa.get('glosario', [])),
        len(mesa.get('necesidades', [])),
        len(mesa.get('tarjetas', [])),
        len(_criticas(mesa)),
        bloques,
        micro,
        len(mesa.get('divergencias', [])),
        pendientes,
        len(mesa.get('acciones', [])),
    ]


def contar_campos(mesa):
    """Campos que el equipo escribió o marcó, con las reglas de la hoja Ligereza.

    No se cuenta lo que llega prellenado con el caso (canvas, mapa, declaración y el plan de I3 vienen del contenido,
    y los términos semilla solo cuentan si alguien los editó) ni lo automático (IDs, fuentes heredadas y lecturas).
    """
    ap = mesa.get('apertura', {})
    c = {}
    # 01: por perfil crítico, la reformulación y ¿equivalente?; más los ajustes.
    c['01'] = len(ap.get('versiones', {})) + len(ap.get('equivalencia', {})) + (1 if ap.get('ajustes') else 0)
    # 03: por término, término y definición (texto), crítico y estado (selección).
    c['03'] = sum(_llenos(t, ('termino', 'definicion', 'critico', 'estado')) for t in mesa.get('glosario', []) if t.get('editadoPor'))
    # 04: por necesidad, necesidad, contexto y valor y supuestos (texto); bloque, fuente, prioridad y estado (selección).
    c['04'] = sum(_llenos(n, ('necesidad', 'contextoValor', 'supuestos', 'bloque', 'fuente', 'prioridad', 'estado')) for n in mesa.get('necesidades', []))
    # 05: por requisito, enunciado y criterio con ejemplo (texto); necesidad, tipo, crítico y prioridad (selección).
    c['05'] = sum(_llenos(t, ('enunciado', 'criterioEjemplo', 'necesidadId', 'tipo', 'critico', 'prioridad')) for t in mesa.get('tarjetas', []))
    # 06: 4 de texto y la conformidad; por divergencia, 2 de texto y 3 de selección, y 2 más si queda pendiente.
    c['06'] = _llenos(mesa.get('validacion06'), ('conjunto', 'fechaParticipantes', 'tecnica', 'constancia', 'conformidad')) + sum(
        _llenos(d, ('descripcion', 'resolucion', 'detectadaEn', 'afectaA', 'estado'))
        + (_llenos(d, ('responsable', 'fechaLimite')) if d.get('estado') != 'Resuelta y confirmada' else 0)
        for d in mesa.get('divergencias', [])
    )
    # 07: la fecha de congelamiento si la marcó alguien, E1–E5, 3 por reconstrucción y 3 por acción.
    lb = mesa.get('lineaBase', {})
    congelada = 1 if lb.get('congeladaEn') and lb.get('congeladaPor') not in (None, 'sistema') else 0
    traspaso = mesa.get('traspaso', {}).get('items', {}).values()
    c['07'] = congelada + len(lb.get('evidencias', {})) + sum(
        (2 if x.get('reconstruccion') else 0) + (1 if x.get('coincide') else 0) for x in traspaso
    ) + sum(_llenos(a, ('accion', 'responsable', 'fecha')) for a in mesa.get('acciones', []))
    # I2: 1 por requisito revisado, B1 y B2 (B3 es automática) y, por crítico, C1–C3 y lo que espera el cliente.
    esperados = mesa.get('esperadosPorNecesidad', {})
    c['I2'] = len(mesa.get('i2a', {})) + _llenos(mesa.get('i2b'), ('B1', 'B2')) + sum(
        _llenos(mesa.get('i2c', {}).get(t['id']), ('C1', 'C2', 'C3'))
        + (1 if (mesa.get('i2c', {}).get(t['id']) or {}).get('esperado') or esperados.get(t.get('necesidadId')) else 0)
        for t in _criticas(mesa)
    )
    # I3: por micro-chequeo hecho, punto crítico, quiénes y qué se acordó, técnica y resultado; 2 por bloque.
    c['I3'] = 4 * sum(1 for r, it in _items_i3(mesa) if it['id'] in (r.get('resultados') or {})) + _llenos(mesa.get('chequeosBloque'), ('c5', 'c6'))
    c['total'] = sum(c.values())
    return c


def llenar_mesa(libro_plantilla: str, mesa: dict, salida: str, contenido: dict | None = None) -> None:
    """Crea en `salida` una copia del libro con los datos de la mesa (y lo prellenado del caso, si llega el contenido)."""
    wb = openpyxl.load_workbook(libro_plantilla)
    _ampliar_glosario(wb, len(mesa.get('glosario', [])))
    contenido = contenido or {}
    p = contenido.get('plantillas', {})
    roles = contenido.get('roles', {})

    ws = _hoja(wb, '01')
    canvas = p.get('canvas', {})
    claves = ['proyecto', 'objetivo', 'alcance', 'restricciones', 'agenda', 'formato', 'insumos', 'participacion', 'riesgos', 'fechaE1', 'fechaE2']
    for fila, clave in zip(range(8, 19), claves):
        escribir(ws, f'C{fila}', canvas.get(clave))
    escribir(ws, 'C21', canvas.get('implicito'))
    escribir(ws, 'C22', canvas.get('malentendido'))
    escribir(ws, 'C24', canvas.get('extensiones'))
    ap = mesa.get('apertura', {})
    # Quien aporta la necesidad (SD), quien especifica o construye (AN) y quien acepta (PO).
    for fila, perfil in ((28, 'SD'), (29, 'AN'), (30, 'PO')):
        version = ap.get('versiones', {}).get(perfil)
        if version:
            escribir(ws, f'B{fila}', f"{_nombre(roles, perfil)}: «{version['texto']}»")
        escribir(ws, f'C{fila}', ap.get('equivalencia', {}).get(perfil))
    escribir(ws, 'C32', ap.get('ajustes'))

    ws = _hoja(wb, '02')
    for i, actor in enumerate(p.get('mapa', [])[:25]):
        for col, clave in zip('ABCDEF', ['actor', 'rol', 'aporta', 'haceLaTarea', 'decide', 'disponibilidad']):
            escribir(ws, f'{col}{9 + i}', actor.get(clave))
    escribir(ws, 'D36', (p.get('chequeoSuficiencia') or {}).get('respuesta'))

    ws = _hoja(wb, '03')
    declaracion = p.get('declaracion', {})
    escribir(ws, 'C7', declaracion.get('enunciado'))
    escribir(ws, 'C8', declaracion.get('afectados'))
    escribir(ws, 'C9', declaracion.get('contraste'))
    for i, t in enumerate(mesa.get('glosario', [])):
        for col, clave in zip('BCDEFG', ['termino', 'definicion', 'ejemplo', 'critico', 'estado', 'responsable']):
            escribir(ws, f'{col}{16 + i}', t.get(clave))

    ws = _hoja(wb, '04')
    for i, n in enumerate(mesa.get('necesidades', [])[:60]):
        for col, clave in zip('BCDEFGH', ['bloque', 'necesidad', 'fuente', 'contextoValor', 'supuestos', 'prioridad', 'estado']):
            escribir(ws, f'{col}{9 + i}', n.get(clave))

    ws = _hoja(wb, '05')
    for i, t in enumerate(mesa.get('tarjetas', [])[:60]):
        for col, clave in zip('BDEFGHIJ', ['necesidadId', 'tipo', 'enunciado', 'critico', 'criterioEjemplo', 'prioridad', 'restriccion', 'acepta']):
            escribir(ws, f'{col}{9 + i}', t.get(clave))

    ws = _hoja(wb, '06')
    v06 = mesa.get('validacion06', {})
    for fila, clave in zip(range(7, 12), ['conjunto', 'fechaParticipantes', 'tecnica', 'conformidad', 'constancia']):
        escribir(ws, f'C{fila}', v06.get(clave))
    for i, d in enumerate(mesa.get('divergencias', [])[:30]):
        for col, clave in zip('BCEFGHI', ['detectadaEn', 'afectaA', 'descripcion', 'resolucion', 'estado', 'responsable', 'fechaLimite']):
            escribir(ws, f'{col}{18 + i}', d.get(clave))

    ws = _hoja(wb, '07')
    lb = mesa.get('lineaBase', {})
    if lb.get('congeladaEn'):
        escribir(ws, 'B7', f"Línea base de la mesa {mesa.get('numero')}")
        escribir(ws, 'B9', _fecha(lb['congeladaEn']))
    for fila, e in zip(range(15, 20), EVIDENCIAS):
        marca = lb.get('evidencias', {}).get(e)
        if marca:
            escribir(ws, f'E{fila}', marca.get('resultado'))
            escribir(ws, f'F{fila}', marca.get('nota'))
    traspaso = mesa.get('traspaso', {})
    for i, (tid, item) in enumerate(list(traspaso.get('items', {}).items())[:8]):
        escribir(ws, f'A{27 + i}', tid)
        if item.get('reconstruccion'):
            escribir(ws, f'B{27 + i}', f"QA de la mesa {traspaso.get('lectorMesa', '?')}: «{item['reconstruccion']}»")
        escribir(ws, f'C{27 + i}', item.get('coincide'))
        escribir(ws, f'D{27 + i}', item.get('correccion'))
    # La fila 45 es el ejemplo del libro: las acciones van desde la 46.
    for i, accion in enumerate(mesa.get('acciones', [])[:10]):
        for col, clave in zip('ABCD', ['origen', 'accion', 'responsable', 'fecha']):
            escribir(ws, f'{col}{46 + i}', accion.get(clave))

    ws = _hoja(wb, 'I2')
    for i, t in enumerate(mesa.get('tarjetas', [])[:60]):
        revision = mesa.get('i2a', {}).get(t['id'])
        if revision:
            escribir(ws, f'C{15 + i}', revision.get('revision'))
            escribir(ws, f'E{15 + i}', revision.get('nota'))
    i2b = mesa.get('i2b', {})
    escribir(ws, 'G78', i2b.get('B1'))
    escribir(ws, 'H78', i2b.get('obsB1'))
    escribir(ws, 'G79', i2b.get('B2'))
    escribir(ws, 'H79', i2b.get('obsB2'))
    esperados = mesa.get('esperadosPorNecesidad', {})
    # La fila 90 + k es el crítico número k + 1, en el orden de 05 (así las numera la columna M de 05).
    for k, t in enumerate(_criticas(mesa)[:25]):
        fila = mesa.get('i2c', {}).get(t['id']) or {}
        for col, clave in zip('CDE', ['C1', 'C2', 'C3']):
            escribir(ws, f'{col}{90 + k}', fila.get(clave))
        escribir(ws, f'F{90 + k}', fila.get('divergenciaId'))
        escribir(ws, f'H{90 + k}', fila.get('esperado') or esperados.get(t.get('necesidadId')))

    ws = _hoja(wb, 'I3')
    for i, (r, item) in enumerate(_items_i3(mesa)[:20]):
        resultado = (r.get('resultados') or {}).get(item['id']) or {}
        escribir(ws, f'B{18 + i}', 1)
        escribir(ws, f'C{18 + i}', item.get('termino'))
        escribir(ws, f'D{18 + i}', item.get('tecnica'))
        escribir(ws, f'E{18 + i}', _respuestas(r, item, mesa))
        escribir(ws, f'G{18 + i}', resultado.get('resultado'))
        escribir(ws, f'H{18 + i}', resultado.get('divergenciaId'))
    chequeos = mesa.get('chequeosBloque', {})
    escribir(ws, 'B44', chequeos.get('c5'))
    escribir(ws, 'D44', chequeos.get('c6'))
    escribir(ws, 'F44', chequeos.get('obs'))

    ws = _hoja(wb, 'Ligereza')
    for fila, valor in zip(range(7, 18), parametros_ligereza(mesa, contenido)):
        escribir(ws, f'B{fila}', valor)

    wb.calculation.fullCalcOnLoad = True
    wb.calculation.forceFullCalc = True
    wb.save(salida)
    wb.close()


def _escribir_csv(ruta, columnas, filas):
    # Punto y coma y BOM, para que Excel en español lo abra con tildes y comas decimales.
    with open(ruta, 'w', encoding='utf-8-sig', newline='') as f:
        w = csv.writer(f, delimiter=';')
        w.writerow(columnas)
        w.writerows(filas)
    return str(ruta)


def _iso(ms):
    return datetime.fromtimestamp(ms / 1000, tz=timezone.utc).isoformat(timespec='seconds')


def generar_csv(exportacion: dict, carpeta: str) -> list[str]:
    """Escribe las mediciones, el glosario completo y los registros del estudio en CSV."""
    destino = Path(carpeta)
    destino.mkdir(parents=True, exist_ok=True)
    personas = {p['id']: p for p in exportacion.get('participantes', [])}

    def mesa_y_roles(pid):
        p = personas.get(pid, {})
        return p.get('mesa', ''), '+'.join(p.get('roles', []))

    contenido = exportacion.get('contenido') or {}
    # En la versión 2 del protocolo la previa se responde con la carta a mano; la posterior, nunca.
    carta_en_previa = bool((contenido.get('protocolo') or {}).get('cartaEnPrevia'))
    filas = []
    for pid, fases in exportacion.get('medicion', {}).items():
        for fase in ('previa', 'posterior'):
            if fases.get(fase):
                con_carta = 'Sí' if fase == 'previa' and carta_en_previa else 'No'
                filas.append([pid, *mesa_y_roles(pid), fase, con_carta, *fases[fase]])
    creados = [_escribir_csv(destino / 'medicion.csv', ['participante', 'mesa', 'roles', 'fase', 'con_carta', 'p1', 'p2', 'p3', 'p4'], filas)]

    filas = []
    for m in exportacion.get('mesas', []):
        for r, item in _items_i3(m):
            resultado = (r.get('resultados') or {}).get(item['id']) or {}
            for pid, texto in (r.get('respuestas') or {}).get(item['id'], {}).items():
                filas.append([m['numero'], r['numero'], item['id'], item.get('termino'), item.get('tecnica'), pid,
                              '+'.join(m.get('miembros', {}).get(pid, [])), texto, resultado.get('resultado', ''), resultado.get('divergenciaId', '')])
    creados.append(_escribir_csv(destino / 'rondas.csv', ['mesa', 'ronda', 'item', 'termino', 'tecnica', 'participante', 'roles', 'respuesta', 'resultado', 'divergencia'], filas))

    filas = [[m['numero'], d.get('id'), d.get('detectadaEn'), d.get('afectaA'), d.get('descripcion'), d.get('resolucion'), d.get('estado', ''),
              d.get('responsable'), d.get('fechaLimite')] for m in exportacion.get('mesas', []) for d in m.get('divergencias', [])]
    creados.append(_escribir_csv(destino / 'divergencias.csv',
                                 ['mesa', 'id', 'detectada_en', 'afecta_a', 'descripcion', 'resolucion', 'estado', 'responsable', 'fecha_limite'], filas))

    campos_glosario = ['id', 'termino', 'definicion', 'ejemplo', 'critico', 'estado', 'responsable', 'editadoPor']
    filas = [[m['numero'], *[t.get(campo, '') for campo in campos_glosario]]
             for m in exportacion.get('mesas', []) for t in m.get('glosario', [])]
    creados.append(_escribir_csv(destino / 'glosario.csv',
                                 ['mesa', 'id', 'termino', 'definicion', 'ejemplo', 'critico', 'estado', 'responsable', 'editado_por'], filas))

    tlx = [e['id'] for e in contenido.get('cuestionario', {}).get('tlx', [])] or [f'tlx{i}' for i in range(1, 7)]
    # Las afirmaciones de utilidad y su orden salen del contenido con que se creó la sesión.
    utilidad_items = [i['id'] for i in ((contenido.get('cuestionario') or {}).get('utilidad') or {}).get('items', [])]
    columnas_utilidad = [*[f'utilidad_{i}' for i in utilidad_items], 'utilidad_abierta'] if utilidad_items else []
    filas = []
    for pid, r in exportacion.get('cuestionario', {}).items():
        utilidad = r.get('utilidad') or {}
        respuestas = utilidad.get('respuestas') or {}
        afirmaciones = r.get('afirmaciones') or []
        carga = r.get('tlx') or []
        filas.append([pid, *mesa_y_roles(pid), *[(afirmaciones + [''] * 5)[i] for i in range(5)],
                      *[(carga + [''] * len(tlx))[i] for i in range(len(tlx))], r.get('abierta', ''),
                      *([*[respuestas.get(i, '') for i in utilidad_items], utilidad.get('abierta', '')] if utilidad_items else [])])
    creados.append(_escribir_csv(destino / 'cuestionario.csv',
                                 ['participante', 'mesa', 'roles', 'a1', 'a2', 'a3', 'a4', 'a5', *[f'tlx_{x}' for x in tlx], 'abierta',
                                  *columnas_utilidad], filas))

    plantillas = ['01', '03', '04', '05', '06', '07', 'I2', 'I3']
    filas = []
    for m in exportacion.get('mesas', []):
        cuenta = contar_campos(m)
        tarjetas = len(m.get('tarjetas', []))
        por_requisito = f"{cuenta['total'] / tarjetas:.1f}".replace('.', ',') if tarjetas else ''
        filas.append([m['numero'], tarjetas, *[cuenta[x] for x in plantillas], cuenta['total'], por_requisito])
    creados.append(_escribir_csv(destino / 'celdas_por_requisito.csv',
                                 ['mesa', 'tarjetas', *[f'campos_{x}' for x in plantillas], 'campos', 'por_requisito'], filas))

    filas = []
    for e in exportacion.get('eventos', []):
        por = e.get('por', {})
        filas.append([e.get('seq'), _iso(e['en']), e.get('tipo'), e.get('mesa', ''), por.get('tipo'), '+'.join(por.get('roles', [])),
                      por.get('id', ''), e.get('opId', ''), json.dumps(e.get('datos', {}), ensure_ascii=False)])
    creados.append(_escribir_csv(destino / 'eventos.csv', ['seq', 'en_utc', 'tipo', 'mesa', 'actor', 'roles', 'participante', 'op_id', 'datos'], filas))
    return creados


def main(argv=None) -> int:
    a = argparse.ArgumentParser(description='Llena el libro de la versión final por mesa con una exportación de Tomatera.')
    a.add_argument('exportacion', help='El JSON que se descarga desde la vista de los autores')
    a.add_argument('salida', help='La carpeta donde quedan los libros y los CSV')
    a.add_argument('--libro', default=str(LIBRO), help='El libro de la versión final que se usa como plantilla')
    args = a.parse_args(argv)
    exportacion = json.loads(Path(args.exportacion).read_text(encoding='utf-8'))
    salida = Path(args.salida)
    salida.mkdir(parents=True, exist_ok=True)
    for m in exportacion.get('mesas', []):
        destino = salida / f"mesa-{m['numero']:02d}.xlsx"
        llenar_mesa(args.libro, m, str(destino), exportacion.get('contenido'))
        print(destino)
    for ruta in generar_csv(exportacion, str(salida)):
        print(ruta)
    return 0


if __name__ == '__main__':
    sys.exit(main())
