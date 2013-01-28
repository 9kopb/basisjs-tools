
  basis.require('basis.entity');
  basis.require('{=name}.service');


  //
  // main part
  //

  var Type = new basis.entity.EntityType({
  	name: 'Type',
  	fields: {
  		id: basis.entity.IntId,
  		title: String
  	}
  });

  /* 
  Type.all.setSyncAction({=name}.service['default'].createAction({
  	controller: 'type',
  	success: function(data){
  		this.sync(basis.array(data).map(Type.reader));
  	}
  }));
  */


  //
  // export names
  //

  module.exports = Type;
