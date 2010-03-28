require 'pathname'
require 'crxmake'
require 'json'

class Pathname
  def [] x
    join x
  end

  def to_str
    to_s
  end
end

NAME     = "wetbanana"
ROOT     = Pathname.new(__FILE__).dirname.realpath
SRC      = ROOT["src"]
BUILD    = ROOT["build"]
CRX      = BUILD["#{NAME}.crx"]
KEY      = ROOT["key.pem"]
MANIFEST = JSON.parse SRC["manifest.json"].read
VERSION  = MANIFEST['version'].split(/\D/).map &:to_i

puts "NAME: #{NAME} #{VERSION}"
puts "ROOT: #{ROOT}"

def write_manifest
  File.open SRC["manifest.json"],'w' do |io|
    io.write JSON.pretty_generate MANIFEST
  end
end

def write_version
  MANIFEST["version"] = VERSION.join('.')
  write_manifest
end

file CRX do |t|
  CrxMake.make( :ex_dir => SRC,
                :pkey   => KEY,
                :crx_output => CRX,
                :verbose => true,
                :ignoredir => /\.git/
              )
end

desc "build a signed .crx file"
task :build => CRX

desc "clean generated files"
task :clean do
  CRX.delete
end

namespace :beta do
  desc "bump the beta build version"
  task :bump do
    4.times {|i| VERSION[i] ||= 0 }
    VERSION[3] += 1
    write_version
  end

  desc "generate a new beta build"
  task :release => [:bump, :build]
end
