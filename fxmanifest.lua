fx_version 'cerulean'
games { 'gta5' }

name 'vMenu Routing Buckets Plugin'
description 'Named routing buckets: create and manage separate worlds, and move players between them.'
version '1.0.0'
author 'Tom Grobbe'
url 'https://github.com/TomGrobbe/vMenu.RoutingBucketsPlugin/'

files {
    'client/CitizenFX.Base.dll',
    'client/CitizenFX.FiveM.Shared.dll',
    'client/CitizenFX.FiveM.Client.dll',

    'client/MessagePack.dll',
    'client/MessagePack.Annotations.dll',

    'client/Microsoft.NET.StringTools.dll',

    'client/vMenu.Enhanced.PluginContracts.dll',
    'client/vMenu.Enhanced.ClientAPI.dll',

    'client/RoutingBucketsPlugin.Shared.dll',
}

client_script 'client/RoutingBucketsPlugin.Client.dll'
server_script 'server/RoutingBucketsPlugin.Server.dll'
