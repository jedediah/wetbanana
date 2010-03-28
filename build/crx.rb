#!/usr/bin/env ruby
require 'pathname'
require 'crxmake'

ROOT = Pathname.new(__FILE__).dirname.join('..')
puts "ROOT=#{ROOT}"

CrxMake.make( :ex_dir => ROOT.to_path,
              :pkey   => ROOT["../wetbanana.pem"],
              :crx_output => "../../wetbanana.crx",
              :verbose => true,
              :ignoredir => /build|\.git/
            )

