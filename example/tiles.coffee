@examples ?= {}

datafn = () ->
  a = (i) -> i % 5
  b = (i) -> Math.floor(i / 5)
  value = () -> Math.random()*5 - 2.5
  item = (i) ->
    mod5: a(i)
    floor5: b(i)
    value: value()
  (item(i) for i in [0..24])

@examples.tiles = (dom) ->
  data = polyjs.data data:datafn()
  spec = {
    layers: [
      data: data
      type: 'tile'
      x : 'bin(mod5, 1)'
      y : 'bin(floor5,1)'
      color: 'value'
    ]
    dom: dom
  }
  c = polyjs.chart spec

@examples.tiles_bw = (dom) ->
  data = polyjs.data data:datafn()
  spec = {
    layers: [
      data: data
      type: 'tile'
      x : 'bin(mod5, 1)'
      y : 'bin(floor5,1)'
      color: 'value'
    ]
    guides:
      color: { scale: {type: 'gradient', lower: '#FFF', upper:'#000'} }
    dom: dom
  }
  c = polyjs.chart spec

@examples.tiles_g2 = (dom) ->
  data = polyjs.data data:datafn()
  spec = {
    layers: [
      data: data
      type: 'tile'
      x : 'bin(mod5, 1)'
      y : 'bin(floor5,1)'
      color: 'value'
    ]
    guides:
      color: { scale: {type: 'gradient2', lower: 'red', upper:'blue', middle:'white'}}
    dom: dom
  }
  c = polyjs.chart spec

@examples.tiles_custom = (dom) ->
  data = polyjs.data data:datafn()
  spec = {
    layers: [
      data: data
      type: 'tile'
      x : 'bin(mod5, 1)'
      y : 'bin(floor5,1)'
      color: 'value'
    ]
    guides:
      color: { scale: (value) -> if value < 0 then 'red' else if value < 1 then 'blue' else 'gray'}
    dom: dom
  }
  c = polyjs.chart spec

