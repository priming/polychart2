###
Turns a 'non-strict' spec to a strict one.
See the spec definition for more information.
###
poly.spec = {}

poly.spec.toStrictMode = (spec) ->
  spec = _.clone spec
  # layer -> guides
  if not spec.layers? and spec.layer
    spec.layers = [spec.layer]
  # guide -> guides
  if not spec.guides? and spec.guide
    spec.guides = spec.guide
  if not spec.guides?
    spec.guides = {}
  if spec.layers
    for layer, i in spec.layers
      # wrap aes mapping defined by a string in an object: "col" -> {var: "col"}
      for aes in poly.const.aes
        if layer[aes] and _.isString layer[aes] then layer[aes] = { var: layer[aes] }
      # put all the level/min/max filtering into the "filter" group
      # TODO
      # provide a dfault "sample" value
      if not layer.sample?
        layer.sample = 500
  if spec.facet
    for v in ['var', 'x', 'y']
      facetvar = spec.facet[v]
      if facetvar and _.isString facetvar then spec.facet[v] = { var: facetvar }
  else
    spec.facet = {type: 'none'}
  if not spec.coord
    spec.coord = {type: 'cartesian', flip: false}
  if _.isString spec.dom
    spec.dom = document.getElementById(spec.dom)
  spec

poly.spec.check = (spec) ->
  if not spec.layers? or spec.layers.length is 0
    throw poly.error.defn "No layers are defined in the specification."
  for layer, id in spec.layers
    if not layer.data?
      throw poly.error.defn "Layer #{id+1} does not have data to plot!"
    if not layer.data.isData
      throw poly.error.defn "Data must be a Polychart Data object."
  if not (spec.render? and spec.render is false) and not spec.dom
    throw poly.error.defn "No DOM element specified. Where to make plot?"
  spec

